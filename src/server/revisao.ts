import "server-only";
import { and, asc, count, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { flashcards, flashcardsRevisao, questoes, questoesRevisao, reportes } from "@/db/schema";
import type { StatusRevisao } from "@/lib/revisao";

// Consultas da tela de revisão (/admin/revisao). questoes_revisao é a área de espera das questões
// geradas por IA: dezenas de milhares no máximo, só o dono lê, e o índice (status, topico_taxonomia)
// cobre os filtros e contagens. As contagens por grupo aqui não tocam em "questoes".

export const POR_PAGINA = 15;

export type FiltroRevisao = { status: StatusRevisao; topico?: string; auditoria?: string; depoisDe?: number };

export async function resumoRevisao() {
  const linhas = await db
    .select({ status: questoesRevisao.status, topico: questoesRevisao.topicoTaxonomia, assunto: questoesRevisao.assunto, total: count() })
    .from(questoesRevisao)
    .groupBy(questoesRevisao.status, questoesRevisao.topicoTaxonomia, questoesRevisao.assunto);
  const porStatus: Record<string, number> = {};
  const topicos = new Map<string, { id: string; nome: string; pendentes: number; total: number }>();
  for (const l of linhas) {
    porStatus[l.status] = (porStatus[l.status] ?? 0) + l.total;
    const t = topicos.get(l.topico) ?? { id: l.topico, nome: l.assunto, pendentes: 0, total: 0 };
    t.total += l.total;
    if (l.status === "pendente_revisao") t.pendentes += l.total;
    topicos.set(l.topico, t);
  }
  return { porStatus, topicos: [...topicos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) };
}

/** Uma página da fila, em ordem de id (cursor, sem OFFSET). */
export async function listarRevisao(f: FiltroRevisao) {
  const condicoes = [eq(questoesRevisao.status, f.status)];
  if (f.topico) condicoes.push(eq(questoesRevisao.topicoTaxonomia, f.topico));
  if (f.auditoria) condicoes.push(eq(questoesRevisao.statusAuditoria, f.auditoria));
  if (f.depoisDe) condicoes.push(gt(questoesRevisao.id, f.depoisDe));
  const linhas = await db
    .select()
    .from(questoesRevisao)
    .where(and(...condicoes))
    .orderBy(asc(questoesRevisao.id))
    .limit(POR_PAGINA + 1);
  return { itens: linhas.slice(0, POR_PAGINA), proximo: linhas.length > POR_PAGINA ? linhas[POR_PAGINA - 1]!.id : null };
}

export type ItemRevisao = Awaited<ReturnType<typeof listarRevisao>>["itens"][number];

// ---------- Flashcards ----------

export async function resumoRevisaoFlashcards() {
  const linhas = await db
    .select({ status: flashcardsRevisao.status, topico: flashcardsRevisao.topicoTaxonomia, assunto: flashcardsRevisao.assunto, total: count() })
    .from(flashcardsRevisao)
    .groupBy(flashcardsRevisao.status, flashcardsRevisao.topicoTaxonomia, flashcardsRevisao.assunto);
  const porStatus: Record<string, number> = {};
  const topicos = new Map<string, { id: string; nome: string; pendentes: number; total: number }>();
  for (const l of linhas) {
    porStatus[l.status] = (porStatus[l.status] ?? 0) + l.total;
    const t = topicos.get(l.topico) ?? { id: l.topico, nome: l.assunto, pendentes: 0, total: 0 };
    t.total += l.total;
    if (l.status === "pendente_revisao") t.pendentes += l.total;
    topicos.set(l.topico, t);
  }
  return { porStatus, topicos: [...topicos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) };
}

export async function listarRevisaoFlashcards(f: FiltroRevisao) {
  const condicoes = [eq(flashcardsRevisao.status, f.status)];
  if (f.topico) condicoes.push(eq(flashcardsRevisao.topicoTaxonomia, f.topico));
  if (f.auditoria) condicoes.push(eq(flashcardsRevisao.statusAuditoria, f.auditoria));
  if (f.depoisDe) condicoes.push(gt(flashcardsRevisao.id, f.depoisDe));
  const linhas = await db
    .select()
    .from(flashcardsRevisao)
    .where(and(...condicoes))
    .orderBy(asc(flashcardsRevisao.id))
    .limit(POR_PAGINA + 1);
  return { itens: linhas.slice(0, POR_PAGINA), proximo: linhas.length > POR_PAGINA ? linhas[POR_PAGINA - 1]!.id : null };
}

export type FlashcardRevisao = Awaited<ReturnType<typeof listarRevisaoFlashcards>>["itens"][number];

// ---------- Reportados por alunos ----------

/** Reportes abertos com o conteúdo do item (questão ou flashcard), em ordem de chegada. */
export async function listarReportesAbertos(depoisDe?: number) {
  const lista = await db
    .select()
    .from(reportes)
    .where(and(eq(reportes.situacao, "aberto"), depoisDe ? gt(reportes.id, depoisDe) : undefined))
    .orderBy(asc(reportes.id))
    .limit(POR_PAGINA + 1);
  const itens = lista.slice(0, POR_PAGINA);
  const idsQ = itens.filter((r) => r.tipo === "questao").map((r) => r.itemId);
  const idsF = itens.filter((r) => r.tipo === "flashcard").map((r) => r.itemId);
  const [qs, fs] = await Promise.all([
    idsQ.length
      ? db.select({ id: questoes.id, codigo: questoes.codigo, origem: questoes.origem, enunciado: questoes.enunciado, alternativas: questoes.alternativas, gabarito: questoes.gabarito, comentario: questoes.comentario }).from(questoes).where(inArray(questoes.id, idsQ))
      : [],
    idsF.length ? db.select({ id: flashcards.id, codigo: flashcards.codigo, origem: flashcards.origem, frente: flashcards.frente, verso: flashcards.verso }).from(flashcards).where(inArray(flashcards.id, idsF)) : [],
  ]);
  return {
    itens: itens.map((r) => ({
      ...r,
      questao: r.tipo === "questao" ? (qs.find((q) => q.id === r.itemId) ?? null) : null,
      flashcard: r.tipo === "flashcard" ? (fs.find((f) => f.id === r.itemId) ?? null) : null,
    })),
    proximo: lista.length > POR_PAGINA ? itens[itens.length - 1]!.id : null,
  };
}

export async function contarReportesAbertos() {
  const [r] = await db.select({ n: count() }).from(reportes).where(eq(reportes.situacao, "aberto"));
  return r?.n ?? 0;
}
