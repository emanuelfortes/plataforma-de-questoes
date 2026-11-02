import "server-only";
import { and, asc, count, desc, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { simuladoArquivo, simulados, simuladoTentativas, user } from "@/db/schema";
import { corrigir, FOLGA_ENTREGA_SEG, segundosRestantes } from "@/lib/simulados";
import { nomeCurto } from "./ranking";

// Simulados do Elite. O gabarito oficial só sai do servidor depois que o aluno entrega (como o gabarito das
// questões, regra 3 do CLAUDE.md). Um simulado aparece para o aluno quando está liberado e o PDF está completo.

const questoesDoSimulado = sql<number>`json_array_length(${simulados.gabarito})`;

const camposAluno = {
  id: simulados.id,
  titulo: simulados.titulo,
  concurso: simulados.concurso,
  opcoes: simulados.opcoes,
  questoes: questoesDoSimulado,
  duracaoMin: simulados.duracaoMin,
  liberadoEm: simulados.liberadoEm,
  encerraEm: simulados.encerraEm,
  arquivoBytes: simulados.arquivoBytes,
};

const publicado = and(isNotNull(simulados.arquivoNome), lte(simulados.liberadoEm, sql`unixepoch()`));

export type SimuladoAluno = Awaited<ReturnType<typeof listarSimuladosAluno>>[number];

export async function listarSimuladosAluno(usuarioId: string) {
  return db
    .select({
      ...camposAluno,
      iniciadoEm: simuladoTentativas.iniciadoEm,
      entregueEm: simuladoTentativas.entregueEm,
      acertos: simuladoTentativas.acertos,
    })
    .from(simulados)
    .leftJoin(simuladoTentativas, and(eq(simuladoTentativas.simuladoId, simulados.id), eq(simuladoTentativas.usuarioId, usuarioId)))
    .where(publicado)
    .orderBy(desc(simulados.liberadoEm))
    .limit(100);
}

export function encerrado(s: { encerraEm: Date | null }) {
  return !!s.encerraEm && s.encerraEm.getTime() < Date.now();
}

async function tentativaDe(simuladoId: number, usuarioId: string) {
  const [t] = await db
    .select()
    .from(simuladoTentativas)
    .where(and(eq(simuladoTentativas.simuladoId, simuladoId), eq(simuladoTentativas.usuarioId, usuarioId)))
    .limit(1);
  return t ?? null;
}

type Tentativa = NonNullable<Awaited<ReturnType<typeof tentativaDe>>>;

/** Fecha a tentativa: corrige e grava o tempo (no máximo o tempo da prova). */
async function fecharTentativa(t: Tentativa, gabarito: string[], duracaoMin: number, respostas: string[]) {
  const agora = new Date();
  const tempoSeg = Math.min(Math.floor((agora.getTime() - t.iniciadoEm.getTime()) / 1000), duracaoMin * 60);
  await db
    .update(simuladoTentativas)
    .set({ respostas, entregueEm: agora, acertos: corrigir(gabarito, respostas), tempoSeg })
    .where(and(eq(simuladoTentativas.id, t.id), isNull(simuladoTentativas.entregueEm)));
}

/** Tentativas que passaram do tempo sem entrega (aluno fechou a página): entram com o que foi marcado. */
async function fecharVencidas(simuladoId: number, gabarito: string[], duracaoMin: number) {
  const limite = new Date(Date.now() - (duracaoMin * 60 + FOLGA_ENTREGA_SEG) * 1000);
  const vencidas = await db
    .select()
    .from(simuladoTentativas)
    .where(and(eq(simuladoTentativas.simuladoId, simuladoId), isNull(simuladoTentativas.entregueEm), lte(simuladoTentativas.iniciadoEm, limite)));
  for (const t of vencidas) await fecharTentativa(t, gabarito, duracaoMin, t.respostas);
}

async function simuladoPublicado(id: number) {
  const [s] = await db
    .select({ ...camposAluno, gabarito: simulados.gabarito })
    .from(simulados)
    .where(and(eq(simulados.id, id), publicado))
    .limit(1);
  return s ?? null;
}

/**
 * Tela do simulado para o aluno. O gabarito oficial só vem depois da entrega.
 */
export async function obterSimuladoAluno(id: number, usuarioId: string) {
  const s = await simuladoPublicado(id);
  if (!s) return null;
  await fecharVencidas(id, s.gabarito, s.duracaoMin);
  const t = await tentativaDe(id, usuarioId);
  const { gabarito, ...simulado } = s;
  return {
    simulado,
    tentativa: t && {
      iniciadoEm: t.iniciadoEm,
      respostas: t.respostas,
      entregueEm: t.entregueEm,
      acertos: t.acertos,
      tempoSeg: t.tempoSeg,
    },
    gabarito: t?.entregueEm ? gabarito : null,
  };
}

/** Play: cria a tentativa (uma por aluno). Começar de novo devolve a mesma, com o relógio de antes. */
export async function iniciarTentativa(id: number, usuarioId: string) {
  const s = await simuladoPublicado(id);
  if (!s) return { ok: false as const, erro: "Simulado não encontrado." };
  if (encerrado(s)) return { ok: false as const, erro: "Este simulado já foi encerrado." };
  await db
    .insert(simuladoTentativas)
    .values({ simuladoId: id, usuarioId, iniciadoEm: new Date(), respostas: Array<string>(s.questoes).fill("") })
    .onConflictDoNothing({ target: [simuladoTentativas.simuladoId, simuladoTentativas.usuarioId] });
  return { ok: true as const };
}

/** Respostas válidas para o simulado: uma por questão, só as letras permitidas (ou em branco). */
function respostasValidas(respostas: string[], opcoes: string, questoes: number) {
  return respostas.length === questoes && respostas.every((r) => r === "" || (r.length === 1 && opcoes.includes(r)));
}

/** Guarda as marcações durante a prova (para não perder nada se a página fechar). */
export async function salvarMarcacoes(id: number, usuarioId: string, respostas: string[]) {
  const s = await simuladoPublicado(id);
  const t = await tentativaDe(id, usuarioId);
  if (!s || !t || t.entregueEm || !respostasValidas(respostas, s.opcoes, s.questoes)) return false;
  if (segundosRestantes(t.iniciadoEm, s.duracaoMin) < -FOLGA_ENTREGA_SEG) return false;
  await db
    .update(simuladoTentativas)
    .set({ respostas })
    .where(and(eq(simuladoTentativas.id, t.id), isNull(simuladoTentativas.entregueEm)));
  return true;
}

/** Entrega. Depois do tempo (mais a folga), vale o que estava salvo, não o que chegou agora. */
export async function entregarTentativa(id: number, usuarioId: string, respostas: string[]) {
  const s = await simuladoPublicado(id);
  const t = await tentativaDe(id, usuarioId);
  if (!s || !t) return { ok: false as const, erro: "Comece o simulado antes de entregar." };
  if (t.entregueEm) return { ok: true as const };
  if (!respostasValidas(respostas, s.opcoes, s.questoes)) return { ok: false as const, erro: "Gabarito inválido." };
  const noPrazo = segundosRestantes(t.iniciadoEm, s.duracaoMin) >= -FOLGA_ENTREGA_SEG;
  await fecharTentativa(t, s.gabarito, s.duracaoMin, noPrazo ? respostas : t.respostas);
  return { ok: true as const };
}

export const TAMANHO_RANKING_SIMULADO = 50;

/** Ranking do simulado: mais acertos primeiro; no empate, quem entregou em menos tempo. */
export async function rankingSimulado(id: number, usuarioId: string) {
  const entregue = and(eq(simuladoTentativas.simuladoId, id), isNotNull(simuladoTentativas.entregueEm));
  const [lista, [total]] = await Promise.all([
    db
      .select({ usuarioId: simuladoTentativas.usuarioId, nome: user.name, acertos: simuladoTentativas.acertos, tempoSeg: simuladoTentativas.tempoSeg })
      .from(simuladoTentativas)
      .innerJoin(user, eq(user.id, simuladoTentativas.usuarioId))
      .where(entregue)
      .orderBy(desc(simuladoTentativas.acertos), asc(simuladoTentativas.tempoSeg), asc(simuladoTentativas.entregueEm))
      .limit(TAMANHO_RANKING_SIMULADO),
    db.select({ n: count() }).from(simuladoTentativas).where(entregue),
  ]);
  const minha = await tentativaDe(id, usuarioId);
  let posicao: number | null = null;
  if (minha?.entregueEm && minha.acertos !== null && minha.tempoSeg !== null) {
    const [frente] = await db
      .select({ n: count() })
      .from(simuladoTentativas)
      .where(
        and(
          entregue,
          sql`(${simuladoTentativas.acertos} > ${minha.acertos} OR (${simuladoTentativas.acertos} = ${minha.acertos} AND ${simuladoTentativas.tempoSeg} < ${minha.tempoSeg}))`,
        ),
      );
    posicao = (frente?.n ?? 0) + 1;
  }
  return {
    lista: lista.map((l) => ({ ...l, nome: nomeCurto(l.nome), acertos: l.acertos ?? 0, tempoSeg: l.tempoSeg ?? 0, eu: l.usuarioId === usuarioId })),
    participantes: total?.n ?? 0,
    posicao,
  };
}

// ---------- área do dono ----------

export async function listarSimuladosAdmin() {
  return db
    .select({
      id: simulados.id,
      titulo: simulados.titulo,
      concurso: simulados.concurso,
      opcoes: simulados.opcoes,
      questoes: questoesDoSimulado,
      duracaoMin: simulados.duracaoMin,
      liberadoEm: simulados.liberadoEm,
      encerraEm: simulados.encerraEm,
      arquivoNome: simulados.arquivoNome,
      arquivoBytes: simulados.arquivoBytes,
      gabarito: simulados.gabarito,
      entregas: sql<number>`(select count(*) from ${simuladoTentativas} where ${simuladoTentativas.simuladoId} = ${simulados.id} and ${simuladoTentativas.entregueEm} is not null)`,
    })
    .from(simulados)
    .orderBy(desc(simulados.liberadoEm))
    .limit(200);
}

export async function obterSimuladoAdmin(id: number) {
  const [s] = await db.select().from(simulados).where(eq(simulados.id, id)).limit(1);
  return s ?? null;
}

export async function criarSimulado(dados: {
  titulo: string;
  concurso: string;
  opcoes: string;
  gabarito: string[];
  duracaoMin: number;
  liberadoEm: Date;
  encerraEm: Date | null;
}) {
  const [s] = await db
    .insert(simulados)
    .values({ ...dados, criadoEm: new Date() })
    .returning({ id: simulados.id });
  return s!.id;
}

/** Troca o gabarito (ex.: questão anulada depois) e recorrige todas as entregas. */
export async function atualizarGabarito(id: number, gabarito: string[]) {
  await db.update(simulados).set({ gabarito }).where(eq(simulados.id, id));
  const entregas = await db
    .select({ id: simuladoTentativas.id, respostas: simuladoTentativas.respostas })
    .from(simuladoTentativas)
    .where(and(eq(simuladoTentativas.simuladoId, id), isNotNull(simuladoTentativas.entregueEm)));
  for (const t of entregas) {
    await db.update(simuladoTentativas).set({ acertos: corrigir(gabarito, t.respostas) }).where(eq(simuladoTentativas.id, t.id));
  }
  return entregas.length;
}

export async function atualizarDatas(id: number, dados: { titulo: string; duracaoMin: number; liberadoEm: Date; encerraEm: Date | null }) {
  await db.update(simulados).set(dados).where(eq(simulados.id, id));
}

export async function gravarParte(id: number, parte: number, dados: Buffer) {
  await db
    .insert(simuladoArquivo)
    .values({ simuladoId: id, parte, dados })
    .onConflictDoUpdate({ target: [simuladoArquivo.simuladoId, simuladoArquivo.parte], set: { dados } });
}

/** Fecha o envio do PDF: só publica se todas as partes chegaram (apaga sobras de um envio anterior maior). */
export async function concluirArquivo(id: number, nome: string, bytes: number, partes: number) {
  await db.delete(simuladoArquivo).where(and(eq(simuladoArquivo.simuladoId, id), sql`${simuladoArquivo.parte} >= ${partes}`));
  const [r] = await db
    .select({ n: count(), bytes: sql<number>`coalesce(sum(length(${simuladoArquivo.dados})), 0)` })
    .from(simuladoArquivo)
    .where(eq(simuladoArquivo.simuladoId, id));
  if (r?.n !== partes || Number(r.bytes) !== bytes) return false;
  await db.update(simulados).set({ arquivoNome: nome, arquivoBytes: bytes, partesTotal: partes }).where(eq(simulados.id, id));
  return true;
}

export async function excluirSimulado(id: number) {
  await db.delete(simulados).where(eq(simulados.id, id));
}

/** Partes do PDF, uma por vez (para enviar em fluxo sem juntar tudo na memória). */
export async function* partesDoPdf(id: number, total: number) {
  for (let parte = 0; parte < total; parte++) {
    const [p] = await db
      .select({ dados: simuladoArquivo.dados })
      .from(simuladoArquivo)
      .where(and(eq(simuladoArquivo.simuladoId, id), eq(simuladoArquivo.parte, parte)))
      .limit(1);
    if (!p) return;
    yield new Uint8Array(p.dados);
  }
}

/** Dados do PDF para baixar (só de simulado publicado; o dono baixa qualquer um). */
export async function arquivoDoSimulado(id: number, dono: boolean) {
  const [s] = await db
    .select({ titulo: simulados.titulo, arquivoNome: simulados.arquivoNome, arquivoBytes: simulados.arquivoBytes, partes: simulados.partesTotal })
    .from(simulados)
    .where(dono ? and(eq(simulados.id, id), isNotNull(simulados.arquivoNome)) : and(eq(simulados.id, id), publicado))
    .limit(1);
  return s ?? null;
}
