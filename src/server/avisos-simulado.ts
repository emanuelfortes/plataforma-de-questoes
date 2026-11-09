import "server-only";
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { assinaturas, avisosEnviados, monitores, simulados, user } from "@/db/schema";
import { ehAdmin } from "@/lib/admin";
import { formatarReais, precoDoPlano } from "@/lib/planos";
import { acessoLiberado, eliteLiberado } from "./assinatura";
import { emailSimuladoLiberado, enviarEmail, servicoDeEmail, type DadosAvisoSimulado, type PublicoAviso } from "./email";

// Aviso por e-mail quando um simulado é liberado. Tropa de Elite: "está liberado, faça agora"; os demais: convite
// para incluir (Basic) ou assinar a Tropa de Elite. Começa sozinho na primeira visita a /simulados depois da
// liberação (after(), sem atrasar a página) e o cron diário completa o que faltar.
//
// Cada envio grava antes uma linha em avisos_enviados (chave "simulado:<id>"): quem grava primeiro envia, então
// dois disparos juntos não mandam em dobro. Falhou? A linha sai e a pessoa entra no próximo disparo. Quando todos
// receberam, a linha "*" encerra o aviso. Sem a tabela (scripts/publicacao/avisos-enviados.ts), nada é enviado.

/** Só avisa simulados liberados há até 3 dias (um simulado antigo nunca dispara uma leva de e-mails). */
const JANELA_DIAS = 3;
/** Por disparo: o Gmail aceita uns 500 por dia, e cada envio leva cerca de 1 s. */
const LOTE = 40;
const ORCAMENTO_MS = 40_000;
const CONCLUIDO = "*";

const chaveDo = (id: number) => `simulado:${id}`;
const site = () => (process.env.BETTER_AUTH_URL || "https://riccardonobrega.com").replace(/\/$/, "");

function tempoLegivel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Versão do aviso para cada pessoa, com a mesma regra de acesso do site (assinaturaDoUsuario, eliteLiberado):
 * dono e monitores contam como Tropa de Elite. Três consultas para todos os cadastrados.
 */
export async function publicosDoAviso() {
  const [pessoas, todas, mons] = await Promise.all([
    db.select({ id: user.id, nome: user.name, email: user.email }).from(user),
    db.select().from(assinaturas),
    db.select({ id: monitores.usuarioId }).from(monitores),
  ]);
  const monitor = new Set(mons.map((m) => m.id));
  // A assinatura que vale: a ativa; senão, a de acesso mais longo; senão, a mais recente (igual a assinaturaDoUsuario).
  const vale = new Map<string, (typeof todas)[number]>();
  type A = (typeof todas)[number];
  /** a vale mais que b? */
  const melhor = (a: A, b: A) => {
    const ativa = Number(a.status === "authorized") - Number(b.status === "authorized");
    if (ativa) return ativa > 0;
    const acesso = (a.acessoAte?.getTime() ?? 0) - (b.acessoAte?.getTime() ?? 0);
    if (acesso) return acesso > 0;
    return a.atualizadaEm.getTime() > b.atualizadaEm.getTime();
  };
  for (const a of todas) {
    const atual = vale.get(a.usuarioId);
    if (!atual || melhor(a, atual)) vale.set(a.usuarioId, a);
  }
  return pessoas.map((p) => {
    const a = vale.get(p.id) ?? null;
    const publico: PublicoAviso = ehAdmin(p.email) || monitor.has(p.id) || eliteLiberado(a) ? "elite" : acessoLiberado(a) ? "basico" : "sem-plano";
    return { ...p, publico };
  });
}

/** Envia (um lote de) o aviso de um simulado já liberado. Devolve quantos saíram e quantos faltam. */
export async function avisarSimulado(id: number) {
  const [s] = await db
    .select()
    .from(simulados)
    .where(and(eq(simulados.id, id), isNotNull(simulados.arquivoNome), lte(simulados.liberadoEm, sql`unixepoch()`)))
    .limit(1);
  if (!s) return { enviados: 0, faltam: 0, concluido: false };
  const chave = chaveDo(id);
  const ja = new Set((await db.select({ id: avisosEnviados.usuarioId }).from(avisosEnviados).where(eq(avisosEnviados.chave, chave))).map((r) => r.id));
  if (ja.has(CONCLUIDO)) return { enviados: 0, faltam: 0, concluido: true };

  const pessoas = await publicosDoAviso();
  const pendentes = pessoas.filter((p) => !ja.has(p.id));
  const base: Omit<DadosAvisoSimulado, "url"> = {
    titulo: s.titulo,
    concurso: s.concurso,
    questoes: s.gabarito.length,
    tempo: tempoLegivel(s.duracaoMin),
    prazo: s.encerraEm ? `até ${s.encerraEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}` : "",
    precoElite: formatarReais(precoDoPlano("elite")),
  };

  const inicio = Date.now();
  let enviados = 0;
  let falhas = 0;
  for (const p of pendentes.slice(0, LOTE)) {
    if (Date.now() - inicio > ORCAMENTO_MS) break;
    // Reserva antes de enviar: se outro disparo já reservou esta pessoa, pula.
    const reserva = await db
      .insert(avisosEnviados)
      .values({ chave, usuarioId: p.id, enviadoEm: new Date() })
      .onConflictDoNothing()
      .returning({ id: avisosEnviados.usuarioId });
    if (!reserva.length) continue;
    const url = p.publico === "elite" ? `${site()}/simulados/${id}` : `${site()}/assinatura`;
    const ok = await enviarEmail({ para: p.email, ...emailSimuladoLiberado(p.nome?.trim() || "aluno", p.publico, { ...base, url }) });
    if (ok) {
      enviados++;
      continue;
    }
    await db.delete(avisosEnviados).where(and(eq(avisosEnviados.chave, chave), eq(avisosEnviados.usuarioId, p.id)));
    // Várias falhas seguidas: o serviço de e-mail parou (limite diário, senha). Tenta de novo no próximo disparo.
    if (++falhas >= 3) break;
  }

  const agora = new Set((await db.select({ id: avisosEnviados.usuarioId }).from(avisosEnviados).where(eq(avisosEnviados.chave, chave))).map((r) => r.id));
  const faltam = pessoas.filter((p) => !agora.has(p.id)).length;
  if (!faltam) await db.insert(avisosEnviados).values({ chave, usuarioId: CONCLUIDO, enviadoEm: new Date() }).onConflictDoNothing();
  console.info(`[avisos] simulado ${id}: ${enviados} enviados agora, ${faltam} faltam.`);
  return { enviados, faltam, concluido: !faltam };
}

/**
 * Avisa os simulados liberados nos últimos dias que ainda não foram avisados. Uma consulta leve quando não há nada
 * a fazer. Nunca lança erro (roda em segundo plano depois da página e no cron).
 */
export async function dispararAvisosSimulados() {
  if (!servicoDeEmail()) return;
  try {
    const pendentes = await db
      .select({ id: simulados.id })
      .from(simulados)
      .where(
        and(
          isNotNull(simulados.arquivoNome),
          lte(simulados.liberadoEm, sql`unixepoch()`),
          gte(simulados.liberadoEm, new Date(Date.now() - JANELA_DIAS * 86_400_000)),
          sql`not exists (select 1 from ${avisosEnviados} where ${avisosEnviados.chave} = 'simulado:' || ${simulados.id} and ${avisosEnviados.usuarioId} = ${CONCLUIDO})`,
        ),
      );
    for (const s of pendentes) await avisarSimulado(s.id);
  } catch (erro) {
    // Sem a tabela avisos_enviados (ainda não criada na produção), o aviso fica desligado.
    console.error("[avisos] falha ao disparar avisos de simulado:", erro);
  }
}

/** Situação do aviso de cada simulado (área do dono): quantos já receberam e se terminou. */
export async function situacaoAvisos() {
  try {
    const linhas = await db
      .select({ chave: avisosEnviados.chave, n: sql<number>`count(*)`, concluido: sql<number>`max(${avisosEnviados.usuarioId} = ${CONCLUIDO})` })
      .from(avisosEnviados)
      .where(sql`${avisosEnviados.chave} like 'simulado:%'`)
      .groupBy(avisosEnviados.chave);
    return new Map(linhas.map((l) => [Number(l.chave.slice(9)), { enviados: Number(l.n) - (l.concluido ? 1 : 0), concluido: !!l.concluido }]));
  } catch {
    return null; // tabela ainda não criada
  }
}
