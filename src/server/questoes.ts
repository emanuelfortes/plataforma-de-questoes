import "server-only";
import { and, asc, count, eq, gt, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { assuntos, contagens, disciplinas, questoes, statusQuestao } from "@/db/schema";

import type { FiltroStatus, StatusAluno } from "@/lib/filtros";

export const TAMANHO_PAGINA = 20;

export type FiltrosQuestoes = {
  usuarioId: string;
  disciplinaId?: number;
  assuntoId?: number;
  status: FiltroStatus;
};

export async function listarDisciplinas() {
  return db.select().from(disciplinas).orderBy(asc(disciplinas.nome));
}

export async function listarAssuntos(disciplinaId: number) {
  return db
    .select({ id: assuntos.id, nome: assuntos.nome })
    .from(assuntos)
    .where(eq(assuntos.disciplinaId, disciplinaId))
    .orderBy(asc(assuntos.nome));
}

/**
 * Lista questões com paginação por cursor (WHERE id > cursor). Nunca use OFFSET aqui:
 * com 1 milhão de linhas o OFFSET obriga o banco a ler todas as linhas anteriores.
 * O gabarito e o comentário NÃO saem desta função. Eles só são revelados por responderQuestao.
 */
export async function listarQuestoes(filtros: FiltrosQuestoes & { cursor?: number }) {
  const { usuarioId, disciplinaId, assuntoId, status, cursor } = filtros;

  const condicoes: SQL[] = [];
  if (disciplinaId) condicoes.push(eq(questoes.disciplinaId, disciplinaId));
  if (assuntoId) condicoes.push(eq(questoes.assuntoId, assuntoId));
  if (cursor) condicoes.push(gt(questoes.id, cursor));

  if (status === "nao_resolvidas") condicoes.push(isNull(statusQuestao.questaoId));
  if (status === "resolvidas") condicoes.push(isNotNull(statusQuestao.questaoId));
  if (status === "acertei") condicoes.push(eq(statusQuestao.ultimaCorreta, true));
  if (status === "errei") condicoes.push(eq(statusQuestao.ultimaCorreta, false));

  const linhas = await db
    .select({
      id: questoes.id,
      codigo: questoes.codigo,
      banca: questoes.banca,
      ano: questoes.ano,
      enunciado: questoes.enunciado,
      alternativas: questoes.alternativas,
      disciplina: disciplinas.nome,
      assunto: assuntos.nome,
      ultimaCorreta: statusQuestao.ultimaCorreta,
      tentativas: statusQuestao.tentativas,
    })
    .from(questoes)
    .innerJoin(disciplinas, eq(disciplinas.id, questoes.disciplinaId))
    .leftJoin(assuntos, eq(assuntos.id, questoes.assuntoId))
    .leftJoin(
      statusQuestao,
      and(eq(statusQuestao.questaoId, questoes.id), eq(statusQuestao.usuarioId, usuarioId)),
    )
    .where(condicoes.length ? and(...condicoes) : undefined)
    .orderBy(asc(questoes.id))
    .limit(TAMANHO_PAGINA + 1);

  const temMais = linhas.length > TAMANHO_PAGINA;
  const pagina = linhas.slice(0, TAMANHO_PAGINA).map((l) => ({
    ...l,
    status: (l.tentativas == null
      ? "nao_resolvida"
      : l.ultimaCorreta
        ? "acertou"
        : "errou") as StatusAluno,
  }));

  return {
    questoes: pagina,
    proximoCursor: temMais ? pagina[pagina.length - 1]?.id : undefined,
  };
}

export type QuestaoListada = Awaited<ReturnType<typeof listarQuestoes>>["questoes"][number];

/**
 * Totais para os chips de status. O total do banco vem de "contagens" (pré-calculado na importação).
 * A parte do aluno vem de status_questao, que cresce com o aluno e não com o banco.
 */
export async function contarPorStatus(filtros: Omit<FiltrosQuestoes, "status">) {
  const { usuarioId, disciplinaId, assuntoId } = filtros;

  const chave = assuntoId ? `q:a:${assuntoId}` : disciplinaId ? `q:d:${disciplinaId}` : "q:total";
  const [base] = await db
    .select({ total: contagens.total })
    .from(contagens)
    .where(eq(contagens.chave, chave));
  const totalBanco = base?.total ?? 0;

  const condicoes: SQL[] = [eq(statusQuestao.usuarioId, usuarioId)];
  if (disciplinaId) condicoes.push(eq(questoes.disciplinaId, disciplinaId));
  if (assuntoId) condicoes.push(eq(questoes.assuntoId, assuntoId));

  const [aluno] = await db
    .select({
      resolvidas: count(),
      acertos: sql<number>`coalesce(sum(${statusQuestao.ultimaCorreta}), 0)`,
    })
    .from(statusQuestao)
    .innerJoin(questoes, eq(questoes.id, statusQuestao.questaoId))
    .where(and(...condicoes));

  const resolvidas = aluno?.resolvidas ?? 0;
  const acertos = Number(aluno?.acertos ?? 0);

  return {
    todas: totalBanco,
    nao_resolvidas: Math.max(totalBanco - resolvidas, 0),
    resolvidas,
    acertei: acertos,
    errei: resolvidas - acertos,
  } satisfies Record<FiltroStatus, number>;
}

/** Usado pela server action de resposta. Só aqui o gabarito sai do banco. */
export async function obterGabarito(questaoId: number) {
  const [q] = await db
    .select({
      id: questoes.id,
      gabarito: questoes.gabarito,
      comentario: questoes.comentario,
      letras: questoes.alternativas,
    })
    .from(questoes)
    .where(eq(questoes.id, questaoId));
  return q;
}

