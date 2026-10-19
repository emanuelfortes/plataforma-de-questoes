// Aprovação das questões e flashcards gerados por IA e o ciclo do "reportar erro".
// Usado pela tela /admin/revisao (server actions) e pela produção automática (scripts/questoes).
// Sem "server-only" porque os scripts também importam; nada aqui vai para o cliente.
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "./index";
import { criarGravador } from "./importacao";
import { contagens, flashcards, flashcardsRevisao, questoes, questoesRevisao, reportes } from "./schema";
import { dificuldadePorNivel } from "../lib/dificuldade";
import { bancaInedita, montarComentario } from "../lib/revisao";

export type EdicaoQuestao = { enunciado: string; alternativas: { letra: string; texto: string }[]; gabarito: string; comentario: string };
export type EdicaoFlashcard = { frente: string; verso: string };

/** Soma (ou subtrai) itens nas contagens de total, matéria e área. */
async function ajustarContagens(db: Db, prefixo: "q" | "f", disciplinaId: number, assuntoId: number | null, delta: number) {
  const chaves = [`${prefixo}:total`, `${prefixo}:d:${disciplinaId}`, ...(assuntoId ? [`${prefixo}:a:${assuntoId}`] : [])];
  await db
    .insert(contagens)
    .values(chaves.map((chave) => ({ chave, total: Math.max(delta, 0) })))
    .onConflictDoUpdate({ target: contagens.chave, set: { total: sql`max(${contagens.total} + ${delta}, 0)` } });
}

/** Questão que já está em "questoes" e estava fora do ar volta (com a edição, se houver). */
async function reativarQuestao(db: Db, codigo: string, edicao?: EdicaoQuestao) {
  const [q] = await db.select().from(questoes).where(eq(questoes.codigo, codigo));
  if (!q) return;
  if (edicao) await db.update(questoes).set({ enunciado: edicao.enunciado, alternativas: edicao.alternativas, gabarito: edicao.gabarito, comentario: edicao.comentario }).where(eq(questoes.id, q.id));
  if (q.suspensa) {
    await db.update(questoes).set({ suspensa: false }).where(eq(questoes.id, q.id));
    await ajustarContagens(db, "q", q.disciplinaId, q.assuntoId, 1);
  }
  await db.update(reportes).set({ situacao: "restaurado", resolvidoEm: new Date() }).where(and(eq(reportes.tipo, "questao"), eq(reportes.itemId, q.id), eq(reportes.situacao, "aberto")));
}

/** Copia questões revisadas para "questoes" (com contagens) e marca como aprovadas. Idempotente. */
export async function aprovarQuestoes(db: Db, ids: number[], quem: string, edicao?: EdicaoQuestao) {
  const linhas = await db
    .select()
    .from(questoesRevisao)
    .where(and(inArray(questoesRevisao.id, ids), eq(questoesRevisao.status, "pendente_revisao")));
  if (!linhas.length) return 0;
  const prontas = linhas.map((r) => ({
    tipo: "multipla" as const,
    codigo: r.codigo,
    disciplina: r.disciplina,
    assunto: r.assunto,
    dificuldade: dificuldadePorNivel(r.dificuldade) ?? undefined,
    banca: bancaInedita(r.banca),
    enunciado: edicao?.enunciado ?? r.enunciado,
    alternativas: edicao?.alternativas ?? r.alternativas,
    gabarito: edicao?.gabarito ?? r.gabarito,
    comentario: edicao?.comentario ?? montarComentario(r),
    // Ligação com a revisão (o código já é o mesmo): filtrar as de IA e revisar quando uma lei mudar.
    origem: r.origem,
    topicoTaxonomia: r.topicoTaxonomia,
    subtopico: r.subtopico,
    leiReferencia: r.leiReferencia,
  }));
  // Grava primeiro em "questoes" (ignora código repetido) e só depois marca como aprovada:
  // se cair no meio, aprovar de novo não duplica. Uma questão reportada (já em "questoes") só volta ao ar.
  await criarGravador(db).gravarQuestoes(prontas);
  const agora = new Date();
  for (const p of prontas) {
    await reativarQuestao(db, p.codigo, edicao);
    await db
      .update(questoesRevisao)
      .set({
        status: "aprovada",
        revisadoEm: agora,
        revisadoPor: quem,
        comentarioFinal: p.comentario,
        ...(edicao ? { enunciado: p.enunciado, alternativas: p.alternativas, gabarito: p.gabarito, motivoRevisao: "editada antes de aprovar" } : {}),
      })
      .where(eq(questoesRevisao.codigo, p.codigo));
  }
  return prontas.length;
}

export async function aprovarFlashcards(db: Db, ids: number[], quem: string, edicao?: EdicaoFlashcard) {
  const linhas = await db
    .select()
    .from(flashcardsRevisao)
    .where(and(inArray(flashcardsRevisao.id, ids), eq(flashcardsRevisao.status, "pendente_revisao")));
  if (!linhas.length) return 0;
  const prontos = linhas.map((r) => ({
    tipo: "flashcard" as const,
    codigo: r.codigo,
    disciplina: r.disciplina,
    assunto: r.assunto,
    frente: edicao?.frente ?? r.frente,
    verso: edicao?.verso ?? r.verso,
    origem: r.origem,
    topicoTaxonomia: r.topicoTaxonomia,
    leiReferencia: r.leiReferencia,
  }));
  await criarGravador(db).gravarFlashcards(prontos);
  const agora = new Date();
  for (const p of prontos) {
    const [f] = await db.select().from(flashcards).where(eq(flashcards.codigo, p.codigo));
    if (f) {
      if (edicao) await db.update(flashcards).set({ frente: p.frente, verso: p.verso }).where(eq(flashcards.id, f.id));
      if (f.suspensa) {
        await db.update(flashcards).set({ suspensa: false }).where(eq(flashcards.id, f.id));
        await ajustarContagens(db, "f", f.disciplinaId, f.assuntoId, 1);
      }
      await db.update(reportes).set({ situacao: "restaurado", resolvidoEm: agora }).where(and(eq(reportes.tipo, "flashcard"), eq(reportes.itemId, f.id), eq(reportes.situacao, "aberto")));
    }
    await db
      .update(flashcardsRevisao)
      .set({ status: "aprovada", revisadoEm: agora, revisadoPor: quem, ...(edicao ? { frente: p.frente, verso: p.verso, motivoRevisao: "editado antes de aprovar" } : {}) })
      .where(eq(flashcardsRevisao.codigo, p.codigo));
  }
  return prontos.length;
}

/** Rejeita na fila. Se o item já estava em "questoes"/"flashcards" (foi reportado), continua fora do ar. */
export async function rejeitar(db: Db, tipo: "questao" | "flashcard", id: number, quem: string, motivo: string) {
  const tabela = tipo === "questao" ? questoesRevisao : flashcardsRevisao;
  const [linha] = await db.select({ codigo: tabela.codigo }).from(tabela).where(and(eq(tabela.id, id), eq(tabela.status, "pendente_revisao")));
  if (!linha) return false;
  await db.update(tabela).set({ status: "rejeitada", revisadoEm: new Date(), revisadoPor: quem, motivoRevisao: motivo }).where(eq(tabela.id, id));
  const conteudo = tipo === "questao" ? questoes : flashcards;
  const [item] = await db.select({ id: conteudo.id }).from(conteudo).where(eq(conteudo.codigo, linha.codigo));
  if (item) await db.update(reportes).set({ situacao: "removido", resolvidoEm: new Date() }).where(and(eq(reportes.tipo, tipo), eq(reportes.itemId, item.id), eq(reportes.situacao, "aberto")));
  return true;
}

/**
 * Aluno reportou erro: o item sai do ar (some das listas e das contagens). Se veio da IA, volta para a
 * fila de revisão como pendente; se foi importado por arquivo, fica na aba "Reportados" do /admin/revisao.
 */
export async function suspenderPorReporte(db: Db, tipo: "questao" | "flashcard", itemId: number, usuarioId: string, motivo: string) {
  const conteudo = tipo === "questao" ? questoes : flashcards;
  const [item] = await db.select().from(conteudo).where(eq(conteudo.id, itemId));
  if (!item) return false;
  await db.insert(reportes).values({ tipo, itemId, usuarioId, motivo, criadoEm: new Date() });
  if (!item.suspensa) {
    await db.update(conteudo).set({ suspensa: true }).where(eq(conteudo.id, itemId));
    await ajustarContagens(db, tipo === "questao" ? "q" : "f", item.disciplinaId, item.assuntoId, -1);
  }
  const fila = tipo === "questao" ? questoesRevisao : flashcardsRevisao;
  await db
    .update(fila)
    .set({ status: "pendente_revisao", motivoRevisao: `Reportado por aluno: ${motivo}` })
    .where(eq(fila.codigo, item.codigo));
  return true;
}

/** Aba "Reportados": devolve o item ao ar (reporte improcedente) ou mantém fora. */
export async function resolverReporte(db: Db, reporteId: number, decisao: "restaurado" | "removido") {
  const [r] = await db.select().from(reportes).where(eq(reportes.id, reporteId));
  if (!r || r.situacao !== "aberto") return false;
  const tipo = r.tipo as "questao" | "flashcard";
  const conteudo = tipo === "questao" ? questoes : flashcards;
  if (decisao === "restaurado") {
    const [item] = await db.select().from(conteudo).where(eq(conteudo.id, r.itemId));
    if (item?.suspensa) {
      await db.update(conteudo).set({ suspensa: false }).where(eq(conteudo.id, item.id));
      await ajustarContagens(db, tipo === "questao" ? "q" : "f", item.disciplinaId, item.assuntoId, 1);
    }
    if (item) {
      // Se veio da IA e voltou para a fila só por causa do reporte, a fila volta a "aprovada".
      const fila = tipo === "questao" ? questoesRevisao : flashcardsRevisao;
      await db.update(fila).set({ status: "aprovada", motivoRevisao: null }).where(and(eq(fila.codigo, item.codigo), eq(fila.status, "pendente_revisao")));
    }
  }
  // Todos os reportes abertos do mesmo item são resolvidos juntos.
  await db.update(reportes).set({ situacao: decisao, resolvidoEm: new Date() }).where(and(eq(reportes.tipo, r.tipo), eq(reportes.itemId, r.itemId), eq(reportes.situacao, "aberto")));
  return true;
}
