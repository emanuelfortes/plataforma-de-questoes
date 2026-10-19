// Publica na produção (Turso) as questões e flashcards de IA do local.db que passaram no filtro
// (scripts/publicacao/filtro.ts). Copia também as filas de revisão: os publicados entram como
// "aprovada" e os retidos como "pendente_revisao", com o motivo.
//
//   npx tsx scripts/publicacao/publicar.ts --revisor email@dono      só simula (não grava nada)
//   npx tsx scripts/publicacao/publicar.ts --revisor email@dono --aplicar
//
// Idempotente: código repetido é ignorado (em questoes, flashcards e nas filas).
import "../_env";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Db } from "../../src/db";
import { criarGravador } from "../../src/db/importacao";
import * as schema from "../../src/db/schema";
import { normalizar, semelhanca } from "../../src/lib/catalogo";
import { dificuldadePorNivel } from "../../src/lib/dificuldade";
import { bancaInedita, montarComentario } from "../../src/lib/revisao";
import { recontar } from "../lib/recontar";
import { avaliar } from "./filtro";

const args = process.argv.slice(2);
const APLICAR = args.includes("--aplicar");
const revisor = args[args.indexOf("--revisor") + 1];
if (!args.includes("--revisor") || !revisor || !/^[^@\s]+@[^@\s]+$/.test(revisor)) throw new Error("informe --revisor <e-mail do dono>");

const url = process.env.TURSO_DATABASE_URL ?? "";
if (!url.startsWith("libsql://")) throw new Error("TURSO_DATABASE_URL não é um banco Turso");
const prodCliente = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prod = drizzle(prodCliente, { schema }) as unknown as Db;
const local = drizzle(createClient({ url: "file:local.db" }), { schema });

const LIMITE_DUPLICATA = 0.775;
const conteudo = (enunciado: string, alternativas: { texto: string }[]) => [enunciado, ...alternativas.map((a) => a.texto).sort()].join(" ");

const avaliacoes = await avaliar();
const sobe = new Map(avaliacoes.map((a) => [`${a.tipo}:${a.id}`, a]));

// Produção atual (para deduplicar contra o que já está no ar).
const prodQ = await prod.select({ codigo: schema.questoes.codigo, enunciado: schema.questoes.enunciado, alternativas: schema.questoes.alternativas }).from(schema.questoes);
const prodF = await prod.select({ codigo: schema.flashcards.codigo, frente: schema.flashcards.frente, verso: schema.flashcards.verso }).from(schema.flashcards);
const codigosQ = new Set(prodQ.map((q) => q.codigo));
const codigosF = new Set(prodF.map((f) => f.codigo));
const textosQ = prodQ.map((q) => normalizar(conteudo(q.enunciado, q.alternativas)));
const textosF = prodF.map((f) => normalizar(`${f.frente} ${f.verso}`));
const agora = new Date();

// ---------- questões ----------
const linhasQ = await local.select().from(schema.questoesRevisao);
const publicarQ: Parameters<ReturnType<typeof criarGravador>["gravarQuestoes"]>[0] = [];
const filaQ: (typeof schema.questoesRevisao.$inferInsert)[] = [];
const retidasQ: { lote: string; motivos: string[] }[] = [];
for (const r of linhasQ) {
  const a = sobe.get(`questao:${r.id}`)!;
  const motivos = [...a.motivos];
  const texto = normalizar(conteudo(r.enunciado, r.alternativas));
  if (a.sobe && (codigosQ.has(r.codigo) || textosQ.some((t) => semelhanca(t, texto) >= LIMITE_DUPLICATA))) motivos.push("duplicada de questão já publicada");
  const comentario = montarComentario(r);
  const { id: _, ...semId } = r;
  if (!motivos.length) {
    publicarQ.push({
      tipo: "multipla",
      codigo: r.codigo,
      disciplina: r.disciplina,
      assunto: r.assunto,
      dificuldade: dificuldadePorNivel(r.dificuldade) ?? undefined,
      banca: bancaInedita(r.banca),
      enunciado: r.enunciado,
      alternativas: r.alternativas,
      gabarito: r.gabarito,
      comentario,
      origem: "ia",
      topicoTaxonomia: r.topicoTaxonomia,
      subtopico: r.subtopico,
      leiReferencia: r.leiReferencia,
    });
    codigosQ.add(r.codigo);
    textosQ.push(texto);
    filaQ.push({ ...semId, status: "aprovada", revisadoEm: agora, revisadoPor: revisor, comentarioFinal: comentario });
  } else {
    retidasQ.push({ lote: r.lote, motivos });
    filaQ.push({
      ...semId,
      status: "pendente_revisao",
      revisadoEm: null,
      revisadoPor: null,
      comentarioFinal: null,
      motivoRevisao: `Retida na publicação: ${motivos.join("; ")}`.slice(0, 1900),
      auditoria: { ...r.auditoria, motivos_fila: [...(r.auditoria.motivos_fila ?? []), ...motivos] },
    });
  }
}

// ---------- flashcards ----------
const linhasF = await local.select().from(schema.flashcardsRevisao);
const publicarF: Parameters<ReturnType<typeof criarGravador>["gravarFlashcards"]>[0] = [];
const filaF: (typeof schema.flashcardsRevisao.$inferInsert)[] = [];
const retidosF: { lote: string; motivos: string[] }[] = [];
for (const r of linhasF) {
  const a = sobe.get(`flashcard:${r.id}`)!;
  const motivos = [...a.motivos];
  const texto = normalizar(`${r.frente} ${r.verso}`);
  if (a.sobe && (codigosF.has(r.codigo) || textosF.some((t) => semelhanca(t, texto) >= 0.8))) motivos.push("duplicado de flashcard já publicado");
  const { id: _, ...semId } = r;
  if (!motivos.length) {
    publicarF.push({ tipo: "flashcard", codigo: r.codigo, disciplina: r.disciplina, assunto: r.assunto, frente: r.frente, verso: r.verso, origem: "ia", topicoTaxonomia: r.topicoTaxonomia, leiReferencia: r.leiReferencia });
    codigosF.add(r.codigo);
    textosF.push(texto);
    filaF.push({ ...semId, status: "aprovada", revisadoEm: agora, revisadoPor: revisor });
  } else {
    retidosF.push({ lote: r.lote, motivos });
    filaF.push({
      ...semId,
      status: "pendente_revisao",
      revisadoEm: null,
      revisadoPor: null,
      motivoRevisao: `Retido na publicação: ${motivos.join("; ")}`.slice(0, 1900),
      auditoria: { ...r.auditoria, motivos_fila: [...(r.auditoria.motivos_fila ?? []), ...motivos] },
    });
  }
}

const resumo = {
  questoes: { publicar: publicarQ.length, retidas: retidasQ.length },
  flashcards: { publicar: publicarF.length, retidos: retidosF.length },
  producaoAntes: { questoes: prodQ.length, flashcards: prodF.length },
};
console.log(APLICAR ? "PUBLICANDO" : "SIMULAÇÃO (nada gravado)", JSON.stringify(resumo, null, 2));
const motivosAgrupados = (lista: { motivos: string[] }[]) => {
  const m = new Map<string, number>();
  for (const x of lista) for (const y of x.motivos) m.set(y.replace(/:.*$/, ""), (m.get(y.replace(/:.*$/, "")) ?? 0) + 1);
  return Object.fromEntries(m);
};
console.log("Motivos (questões):", motivosAgrupados(retidasQ), "| (flashcards):", motivosAgrupados(retidosF));

if (args.includes("--sondar")) {
  // Diagnóstico (só leitura): a mesma primeira consulta do gravador, em cliente novo e no antigo.
  for (const [nome, c] of [
    ["cliente novo", createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })],
    ["cliente antigo", prodCliente],
  ] as const) {
    try {
      console.log(nome, (await c.execute('select "id", "nome" from "disciplinas"')).rows.length, "linhas");
    } catch (e) {
      const causa = (e as { cause?: { cause?: { code?: string }; message?: string } }).cause;
      console.log(nome, "FALHOU:", (e as Error).message, causa?.message, causa?.cause?.code);
    }
  }
}

if (APLICAR) {
  // Depois do processamento longo, a primeira requisição ao Turso às vezes cai ("other side closed")
  // e a seguinte funciona. Repete só esse erro de conexão; todas as escritas daqui são idempotentes
  // (código repetido é ignorado) e as contagens são recalculadas do zero no fim.
  const cliente = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const quedaDeConexao = (e: unknown) => /fetch failed|other side closed|UND_ERR_SOCKET|ECONNRESET/i.test(`${(e as Error).message} ${JSON.stringify((e as { cause?: unknown }).cause ?? "")}`);
  const comNovaTentativa =
    <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    async (...a: A): Promise<R> => {
      for (let tentativa = 1; ; tentativa++) {
        try {
          return await fn(...a);
        } catch (e) {
          if (tentativa >= 4 || !quedaDeConexao(e)) throw e;
          console.log(`  conexão caiu (tentativa ${tentativa}); repetindo...`);
          await new Promise((r) => setTimeout(r, 2000 * tentativa));
        }
      }
    };
  cliente.execute = comNovaTentativa(cliente.execute.bind(cliente)) as typeof cliente.execute;
  cliente.batch = comNovaTentativa(cliente.batch.bind(cliente)) as typeof cliente.batch;
  await cliente.execute("select 1");
  const prod = drizzle(cliente, { schema }) as unknown as Db;
  const gravador = criarGravador(prod);
  let q = 0;
  let f = 0;
  for (let i = 0; i < publicarQ.length; i += 200) q += await gravador.gravarQuestoes(publicarQ.slice(i, i + 200));
  for (let i = 0; i < publicarF.length; i += 200) f += await gravador.gravarFlashcards(publicarF.slice(i, i + 200));
  for (let i = 0; i < filaQ.length; i += 100) await prod.insert(schema.questoesRevisao).values(filaQ.slice(i, i + 100)).onConflictDoNothing({ target: schema.questoesRevisao.codigo });
  for (let i = 0; i < filaF.length; i += 100) await prod.insert(schema.flashcardsRevisao).values(filaF.slice(i, i + 100)).onConflictDoNothing({ target: schema.flashcardsRevisao.codigo });
  await recontar(prod);
  console.log(`Gravadas na produção: ${q} questões e ${f} flashcards novos; filas copiadas (${filaQ.length} questões, ${filaF.length} flashcards); contagens recalculadas.`);
}
