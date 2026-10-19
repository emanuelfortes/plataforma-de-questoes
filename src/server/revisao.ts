import "server-only";
import { and, asc, count, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { questoesRevisao } from "@/db/schema";
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
