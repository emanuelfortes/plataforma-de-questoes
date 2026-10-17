import "server-only";
import { and, asc, count, eq, gte, inArray, isNotNull, isNull, lt, sql, sum, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { assuntos, contagens, disciplinas, questoes, statusQuestao } from "@/db/schema";

import { dificuldadePorNivel } from "@/lib/dificuldade";
import type { FiltroStatus, StatusAluno } from "@/lib/filtros";

export const TAMANHO_PAGINA = 20;

export type FiltrosQuestoes = {
  usuarioId: string;
  disciplinaId?: number;
  assuntoIds?: number[]; // vazio = todas as áreas da matéria
  status: FiltroStatus;
};

/**
 * Filtro de área para listagens ordenadas. Uma área: usa o índice (assunto, ordem). Várias: o "+" impede
 * o SQLite de usar o índice de área (teria de juntar e ordenar tudo); ele percorre o índice da matéria,
 * que já está na ordem certa, confere a área e para ao completar a página.
 */
export function filtroAreas(coluna: AnySQLiteColumn, ids: number[] | undefined) {
  if (!ids?.length) return undefined;
  if (ids.length === 1) return eq(coluna, ids[0]!);
  return sql`+${coluna} in (${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )})`;
}

/** Posição na ordem embaralhada: a próxima página começa depois deste par. */
export type CursorQuestoes = { ordem: number; id: number };

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
 * Lista questões em ordem embaralhada, com paginação por cursor. Nunca use OFFSET nem ORDER BY random():
 * com 1 milhão de linhas os dois leem a tabela inteira.
 *
 * Cada questão recebe na importação uma posição sorteada ("ordem"), então níveis e áreas vêm misturados.
 * Cada sessão começa num ponto sorteado ("inicio"): vai de inicio até o fim e depois dá a volta,
 * do começo até inicio ("voltou"). Assim cada aluno, a cada sessão, vê uma sequência diferente.
 *
 * O gabarito e o comentário NÃO saem desta função. Eles só são revelados por responderQuestao.
 */
export async function listarQuestoes(
  filtros: FiltrosQuestoes & { inicio: number; cursor?: CursorQuestoes; voltou: boolean },
) {
  const { usuarioId, disciplinaId, assuntoIds, status, inicio, cursor, voltou } = filtros;

  const condicoes: SQL[] = [];
  if (disciplinaId) condicoes.push(eq(questoes.disciplinaId, disciplinaId));
  const areas = filtroAreas(questoes.assuntoId, assuntoIds);
  if (areas) condicoes.push(areas);

  if (status === "nao_resolvidas") condicoes.push(isNull(statusQuestao.questaoId));
  if (status === "resolvidas") condicoes.push(isNotNull(statusQuestao.questaoId));
  if (status === "acertei") condicoes.push(eq(statusQuestao.ultimaCorreta, true));
  if (status === "errei") condicoes.push(eq(statusQuestao.ultimaCorreta, false));

  const depoisDoCursor = cursor
    ? sql`(${questoes.ordem}, ${questoes.id}) > (${cursor.ordem}, ${cursor.id})`
    : undefined;

  const buscar = (trecho: SQL | undefined, limite: number) =>
    db
      .select({
        id: questoes.id,
        ordem: questoes.ordem,
        codigo: questoes.codigo,
        banca: questoes.banca,
        ano: questoes.ano,
        enunciado: questoes.enunciado,
        alternativas: questoes.alternativas,
        nivel: questoes.dificuldade,
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
      .where(and(...condicoes, trecho))
      .orderBy(asc(questoes.ordem), asc(questoes.id))
      .limit(limite);

  // Trecho 1: de "inicio" até o fim. Trecho 2 (a volta): do começo até "inicio".
  type Linha = Awaited<ReturnType<typeof buscar>>[number] & { daVolta: boolean };
  let linhas: Linha[];
  if (!voltou) {
    const primeiro = await buscar(depoisDoCursor ?? gte(questoes.ordem, inicio), TAMANHO_PAGINA + 1);
    linhas = primeiro.map((l) => ({ ...l, daVolta: false }));
    if (primeiro.length <= TAMANHO_PAGINA && inicio > 0) {
      const volta = await buscar(lt(questoes.ordem, inicio), TAMANHO_PAGINA + 1 - primeiro.length);
      linhas.push(...volta.map((l) => ({ ...l, daVolta: true })));
    }
  } else {
    const volta = await buscar(and(lt(questoes.ordem, inicio), depoisDoCursor), TAMANHO_PAGINA + 1);
    linhas = volta.map((l) => ({ ...l, daVolta: true }));
  }

  const temMais = linhas.length > TAMANHO_PAGINA;
  const visiveis = linhas.slice(0, TAMANHO_PAGINA);
  const ultima = visiveis[visiveis.length - 1];

  const pagina = visiveis.map(({ nivel, ordem: _ordem, daVolta: _daVolta, ...l }) => ({
    ...l,
    dificuldade: dificuldadePorNivel(nivel),
    status: (l.tentativas == null
      ? "nao_resolvida"
      : l.ultimaCorreta
        ? "acertou"
        : "errou") as StatusAluno,
  }));

  return {
    questoes: pagina,
    proximo:
      temMais && ultima
        ? { cursor: { ordem: ultima.ordem, id: ultima.id }, voltou: ultima.daVolta }
        : undefined,
  };
}

export type QuestaoListada = Awaited<ReturnType<typeof listarQuestoes>>["questoes"][number];

/**
 * Totais para os chips de status. O total do banco vem de "contagens" (pré-calculado na importação).
 * A parte do aluno vem de status_questao, que cresce com o aluno e não com o banco.
 */
export async function contarPorStatus(filtros: Omit<FiltrosQuestoes, "status">) {
  const { usuarioId, disciplinaId, assuntoIds } = filtros;

  // Várias áreas: soma as linhas de "contagens" de cada uma.
  const chaves = assuntoIds?.length
    ? assuntoIds.map((id) => `q:a:${id}`)
    : [disciplinaId ? `q:d:${disciplinaId}` : "q:total"];
  const [linhaTotal] = await db
    .select({ total: sum(contagens.total) })
    .from(contagens)
    .where(inArray(contagens.chave, chaves));
  const totalBanco = Number(linhaTotal?.total ?? 0);

  // Parte do aluno: o ponto de partida é status_questao (cresce com o aluno), então o "in" simples basta.
  const condicoes: SQL[] = [eq(statusQuestao.usuarioId, usuarioId)];
  if (disciplinaId) condicoes.push(eq(questoes.disciplinaId, disciplinaId));
  if (assuntoIds?.length) condicoes.push(inArray(questoes.assuntoId, assuntoIds));

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
