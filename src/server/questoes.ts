import "server-only";
import { and, asc, count, eq, gte, inArray, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { artigosQuestao, assuntos, contagens, disciplinas, questoes, statusQuestao } from "@/db/schema";

import { dificuldadePorNivel } from "@/lib/dificuldade";
import { totalDoFiltro } from "@/lib/contagens";
import { NIVEL_DIFICULDADE, PESO_NIVEL } from "@/lib/dificuldade";
import type { DificuldadeFiltro, FiltroStatus, StatusAluno, TipoQuestao } from "@/lib/filtros";

export const TAMANHO_PAGINA = 20;

export type FiltrosQuestoes = {
  usuarioId: string;
  disciplinaId?: number;
  assuntoIds?: number[]; // vazio = todas as áreas da matéria
  status: FiltroStatus;
  /** Opções da tela de filtro. Vazio = todos os níveis. */
  dificuldades?: DificuldadeFiltro[];
  tipo?: TipoQuestao;
  /** Vade Mecum: só as questões de um artigo de lei (ids de artigos_questao). Substitui matéria e área. */
  ids?: number[];
};

/** Questões que cobram um artigo de lei. Leitura pela chave primária (lei, artigo) de artigos_questao. */
export async function idsDoArtigo(lei: string, artigo: string) {
  const linhas = await db
    .select({ id: artigosQuestao.questaoId })
    .from(artigosQuestao)
    .where(and(eq(artigosQuestao.lei, lei), eq(artigosQuestao.artigo, artigo)));
  return linhas.map((l) => l.id);
}

/**
 * Certo ou errado (estilo Cebraspe) é guardado como duas alternativas, "Certo" e "Errado" (docs/FORMATO-QUESTOES.md).
 * Não há coluna própria: o filtro confere o JSON da linha que o índice (matéria ou área, ordem) já está lendo.
 */
const EH_CERTO_ERRADO = sql`(json_array_length(${questoes.alternativas}) = 2 and exists (select 1 from json_each(${questoes.alternativas}) where lower(trim(json_extract(value, '$.texto'))) = 'certo'))`;

/** Filtros de dificuldade e tipo: conferidos na linha, sem índice próprio (não mudam o plano da listagem). */
export function filtrosDeOpcoes(dificuldades: DificuldadeFiltro[] | undefined, tipo: TipoQuestao | undefined) {
  const condicoes: SQL[] = [];
  // O "+" impede o SQLite de trocar o índice da listagem por outro caminho.
  if (dificuldades?.length && dificuldades.length < 3)
    condicoes.push(sql`+${questoes.dificuldade} in (${sql.join(dificuldades.map((d) => sql`${NIVEL_DIFICULDADE[d]}`), sql`, `)})`);
  if (tipo === "certo_errado") condicoes.push(EH_CERTO_ERRADO);
  if (tipo === "multipla") condicoes.push(sql`not ${EH_CERTO_ERRADO}`);
  return condicoes;
}

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

/** Onde uma fila parou: depois deste par (ordem, id), se já deu a volta e se acabou. Sem cursor = do começo. */
export type PosicaoFila = { cursor?: CursorQuestoes; voltou: boolean; fim?: boolean };
/** Uma posição por fila: "t" (todas, no artigo de lei), "1", "2", "3" (níveis) e "0" (sem nível). */
export type PosicoesQuestoes = Record<string, PosicaoFila>;

const CHAVES_FILA = ["t", "1", "2", "3", "0"] as const;

/** Posições na URL: n1=ordem.id (".v" se já deu a volta) ou n1=fim. Sem o parâmetro, a fila está no começo. */
export function lerPosicoes(texto: (k: string) => string | undefined): PosicoesQuestoes {
  const posicoes: PosicoesQuestoes = {};
  for (const chave of CHAVES_FILA) {
    const valor = texto(`n${chave}`);
    if (!valor) continue;
    if (valor === "fim") {
      posicoes[chave] = { voltou: true, fim: true };
      continue;
    }
    const [ordem, id, v] = valor.split(".");
    const o = Number(ordem);
    const i = Number(id);
    if (Number.isInteger(o) && o >= 0 && Number.isInteger(i) && i > 0) posicoes[chave] = { cursor: { ordem: o, id: i }, voltou: v === "v" };
  }
  return posicoes;
}

export function escreverPosicoes(p: URLSearchParams, posicoes: PosicoesQuestoes) {
  for (const [chave, pos] of Object.entries(posicoes)) {
    if (pos.fim) p.set(`n${chave}`, "fim");
    else if (pos.cursor) p.set(`n${chave}`, `${pos.cursor.ordem}.${pos.cursor.id}${pos.voltou ? ".v" : ""}`);
  }
}

/**
 * Rodízio ponderado suave: devolve a fila de cada vaga, espalhando os pesos (5, 3, 2 dá F M F D F M F M D F).
 * "pode" diz se a fila ainda tem o que dar, sabendo quantas vagas ela já levou.
 */
function rodizio(pesos: number[], vagas: number, pode: (i: number, levadas: number) => boolean) {
  const acumulado = pesos.map(() => 0);
  const levadas = pesos.map(() => 0);
  const saida: number[] = [];
  while (saida.length < vagas) {
    const ativas = pesos.map((_, i) => i).filter((i) => pode(i, levadas[i]!));
    if (!ativas.length) break;
    let soma = 0;
    let melhor = ativas[0]!;
    for (const i of ativas) {
      soma += pesos[i]!;
      acumulado[i]! += pesos[i]!;
      if (acumulado[i]! > acumulado[melhor]!) melhor = i;
    }
    acumulado[melhor]! -= soma;
    levadas[melhor]!++;
    saida.push(melhor);
  }
  return saida;
}

/**
 * Lista questões em ordem embaralhada, com paginação por cursor. Nunca use OFFSET nem ORDER BY random():
 * com 1 milhão de linhas os dois leem a tabela inteira.
 *
 * Cada questão recebe na importação uma posição sorteada ("ordem"). Cada sessão começa num ponto sorteado
 * ("inicio"): vai de inicio até o fim e depois dá a volta, do começo até inicio ("voltou").
 *
 * Níveis: uma fila por nível, cada uma com o próprio cursor e o índice (matéria ou área, nível, ordem). A página
 * junta as filas na proporção de PESO_NIVEL (5 fáceis, 3 médias e 2 difíceis a cada 10). Se um nível acaba,
 * os outros completam. Com o filtro de nível, só os níveis escolhidos, na mesma proporção entre si.
 *
 * O gabarito e o comentário NÃO saem desta função. Eles só são revelados por responderQuestao.
 */
export async function listarQuestoes(filtros: FiltrosQuestoes & { inicio: number; posicoes: PosicoesQuestoes }) {
  const { usuarioId, disciplinaId, assuntoIds, status, inicio, posicoes, dificuldades, tipo, ids } = filtros;

  // Questão reportada por aluno fica fora do ar até ser revisada.
  const condicoes: SQL[] = [eq(questoes.suspensa, false)];
  type Fila = { chave: string; nivel?: SQL; peso: number };
  let filas: Fila[];
  if (ids) {
    // Artigo de lei: poucas questões, buscadas pela chave primária (o SQLite ordena só elas). Uma fila só.
    condicoes.push(inArray(questoes.id, ids.length ? ids : [-1]));
    condicoes.push(...filtrosDeOpcoes(dificuldades, tipo));
    filas = [{ chave: "t", peso: 1 }];
  } else {
    if (disciplinaId) condicoes.push(eq(questoes.disciplinaId, disciplinaId));
    const areas = filtroAreas(questoes.assuntoId, assuntoIds);
    if (areas) condicoes.push(areas);
    condicoes.push(...filtrosDeOpcoes(undefined, tipo));
    const escolhidos: number[] = dificuldades?.length ? dificuldades.map((d) => NIVEL_DIFICULDADE[d]) : [1, 2, 3];
    filas = ([1, 2, 3] as const)
      .filter((n) => escolhidos.includes(n))
      .map((n) => ({ chave: String(n), nivel: eq(questoes.dificuldade, n), peso: PESO_NIVEL[n] }));
    // Sem filtro de nível, a questão sem nível também entra (na prática não há: a IA e a importação dão o nível).
    if (filas.length === 3) filas.push({ chave: "0", nivel: isNull(questoes.dificuldade), peso: PESO_NIVEL[0] });
  }

  if (status === "nao_resolvidas") condicoes.push(isNull(statusQuestao.questaoId));
  if (status === "resolvidas") condicoes.push(isNotNull(statusQuestao.questaoId));
  if (status === "acertei") condicoes.push(eq(statusQuestao.ultimaCorreta, true));
  if (status === "errei") condicoes.push(eq(statusQuestao.ultimaCorreta, false));

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

  type Linha = Awaited<ReturnType<typeof buscar>>[number] & { daVolta: boolean };

  /** Até "limite" questões de uma fila a partir da posição. Trecho 1: de inicio até o fim; trecho 2 (a volta): do começo até inicio. */
  async function lerFila(fila: Fila, pos: PosicaoFila, limite: number): Promise<Linha[]> {
    const depois = pos.cursor ? sql`(${questoes.ordem}, ${questoes.id}) > (${pos.cursor.ordem}, ${pos.cursor.id})` : undefined;
    if (pos.voltou) return (await buscar(and(fila.nivel, lt(questoes.ordem, inicio), depois), limite)).map((l) => ({ ...l, daVolta: true }));
    const primeiro = (await buscar(and(fila.nivel, depois ?? gte(questoes.ordem, inicio)), limite)).map((l) => ({ ...l, daVolta: false }));
    if (primeiro.length >= limite || inicio === 0) return primeiro;
    const volta = await buscar(and(fila.nivel, lt(questoes.ordem, inicio)), limite - primeiro.length);
    return [...primeiro, ...volta.map((l) => ({ ...l, daVolta: true }))];
  }

  const pesos = filas.map((f) => f.peso);
  const inicial = filas.map((f): PosicaoFila => posicoes[f.chave] ?? { voltou: false });

  // Quantas de cada fila a página pede (uma a mais para saber se há próxima página).
  const cota = filas.map(() => 0);
  for (const i of rodizio(pesos, TAMANHO_PAGINA, (i) => !inicial[i]!.fim)) cota[i]!++;
  const lidas = await Promise.all(filas.map((f, i) => (cota[i] ? lerFila(f, inicial[i]!, cota[i]! + 1) : Promise.resolve([] as Linha[]))));
  // Esgotada: a fila devolveu menos do que foi pedido (não há mais nada nela).
  const esgotada = filas.map((_, i) => inicial[i]!.fim === true || lidas[i]!.length < cota[i]! + 1);

  // Um nível acabou e a página não fechou: as outras filas completam (uma leitura a mais, só nesse caso).
  const lidasAteAqui = lidas.reduce((s, l) => s + l.length, 0);
  if (lidasAteAqui < TAMANHO_PAGINA + 1) {
    const falta = TAMANHO_PAGINA + 1 - lidasAteAqui;
    await Promise.all(
      filas.map(async (f, i) => {
        if (esgotada[i]) return;
        const ultima = lidas[i]!.at(-1);
        const pos: PosicaoFila = ultima ? { cursor: { ordem: ultima.ordem, id: ultima.id }, voltou: ultima.daVolta } : inicial[i]!;
        const mais = await lerFila(f, pos, falta);
        lidas[i]!.push(...mais);
        if (mais.length < falta) esgotada[i] = true;
      }),
    );
  }

  // Monta a página no rodízio dos pesos, só com o que cada fila tem.
  const usadas = filas.map(() => 0);
  const visiveis = rodizio(pesos, TAMANHO_PAGINA, (i, levadas) => levadas < lidas[i]!.length).map((i) => lidas[i]![usadas[i]!++]!);
  const temMais = filas.some((_, i) => usadas[i]! < lidas[i]!.length || !esgotada[i]);

  const proximas: PosicoesQuestoes = {};
  filas.forEach((f, i) => {
    const ultima = usadas[i] ? lidas[i]![usadas[i]! - 1] : undefined;
    if (esgotada[i] && usadas[i] === lidas[i]!.length) proximas[f.chave] = { voltou: true, fim: true };
    else if (ultima) proximas[f.chave] = { cursor: { ordem: ultima.ordem, id: ultima.id }, voltou: ultima.daVolta };
    else proximas[f.chave] = inicial[i]!;
  });

  const pagina = visiveis.map(({ nivel, ordem: _ordem, daVolta: _daVolta, ...l }) => ({
    ...l,
    dificuldade: dificuldadePorNivel(nivel),
    status: (l.tentativas == null
      ? "nao_resolvida"
      : l.ultimaCorreta
        ? "acertou"
        : "errou") as StatusAluno,
  }));

  return { questoes: pagina, proximo: temMais ? proximas : undefined };
}


export type QuestaoListada = Awaited<ReturnType<typeof listarQuestoes>>["questoes"][number];

/**
 * Totais para os chips de status. O total do banco vem de "contagens" (pré-calculado na importação).
 * A parte do aluno vem de status_questao, que cresce com o aluno e não com o banco.
 */
export async function contarPorStatus(filtros: Omit<FiltrosQuestoes, "status">) {
  const { usuarioId, disciplinaId, assuntoIds, dificuldades, tipo, ids } = filtros;

  // Artigo de lei: conta só as questões dele (dezenas, pela chave primária), já com as opções.
  if (ids) {
    const [banco] = await db
      .select({ n: count() })
      .from(questoes)
      .where(and(inArray(questoes.id, ids.length ? ids : [-1]), eq(questoes.suspensa, false), ...filtrosDeOpcoes(dificuldades, tipo)));
    const [meu] = await db
      .select({ resolvidas: count(), acertos: sql<number>`coalesce(sum(${statusQuestao.ultimaCorreta}), 0)` })
      .from(statusQuestao)
      .innerJoin(questoes, eq(questoes.id, statusQuestao.questaoId))
      .where(and(eq(statusQuestao.usuarioId, usuarioId), inArray(statusQuestao.questaoId, ids.length ? ids : [-1]), eq(questoes.suspensa, false), ...filtrosDeOpcoes(dificuldades, tipo)));
    const total = banco?.n ?? 0;
    const resolvidas = meu?.resolvidas ?? 0;
    const acertos = Number(meu?.acertos ?? 0);
    return { todas: total, nao_resolvidas: Math.max(total - resolvidas, 0), resolvidas, acertei: acertos, errei: resolvidas - acertos } satisfies Record<FiltroStatus, number>;
  }

  // Total do banco para o filtro, só com chaves prontas de "contagens" (por área ou matéria, dificuldade e
  // tipo; src/lib/contagens.ts). Nunca COUNT(*) em questoes.
  const escopos = assuntoIds?.length ? assuntoIds.map((id) => `q:a:${id}`) : [disciplinaId ? `q:d:${disciplinaId}` : "q"];
  const { chaves, calcular } = totalDoFiltro(escopos, dificuldades ?? [], tipo);
  const lidas = await db
    .select({ chave: contagens.chave, total: contagens.total })
    .from(contagens)
    .where(inArray(contagens.chave, chaves));
  const totalBanco = calcular(new Map(lidas.map((l) => [l.chave, l.total])));

  // Parte do aluno: o ponto de partida é status_questao (cresce com o aluno), então o "in" simples basta.
  const condicoes: SQL[] = [eq(statusQuestao.usuarioId, usuarioId), eq(questoes.suspensa, false)];
  if (disciplinaId) condicoes.push(eq(questoes.disciplinaId, disciplinaId));
  if (assuntoIds?.length) condicoes.push(inArray(questoes.assuntoId, assuntoIds));
  condicoes.push(...filtrosDeOpcoes(dificuldades, tipo));

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
    .where(and(eq(questoes.id, questaoId), eq(questoes.suspensa, false)));
  return q;
}
