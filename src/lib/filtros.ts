// Tipos e constantes compartilhados entre servidor e cliente (não importe nada de servidor aqui).

export const FILTROS_STATUS = ["todas", "nao_resolvidas", "resolvidas", "acertei", "errei"] as const;
export type FiltroStatus = (typeof FILTROS_STATUS)[number];

export type StatusAluno = "nao_resolvida" | "acertou" | "errou";

export function lerFiltroStatus(valor: string | undefined): FiltroStatus {
  return (FILTROS_STATUS as readonly string[]).includes(valor ?? "")
    ? (valor as FiltroStatus)
    : "todas";
}

export function lerId(valor: string | undefined) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** Áreas escolhidas juntas (?assunto=3&assunto=7). Sem nenhuma = todas as áreas da matéria. */
// 80: "Todo o conteúdo" de um título grande do CP (ex.: Administração Pública) marca dezenas de crimes.
export const MAX_AREAS = 80;
export function lerIds(valor: string | string[] | undefined) {
  const lista = Array.isArray(valor) ? valor : valor ? [valor] : [];
  const ids = lista.map(lerId).filter((n): n is number => n !== undefined);
  return [...new Set(ids)].slice(0, MAX_AREAS);
}

// Opções da tela de filtro (além de matéria e área). Vão na URL: ?dificuldade=facil&dificuldade=medio&tipoq=certo_errado
export const DIFICULDADES_FILTRO = ["facil", "medio", "dificil"] as const;
export type DificuldadeFiltro = (typeof DIFICULDADES_FILTRO)[number];
export const ROTULO_DIFICULDADE_FILTRO: Record<DificuldadeFiltro, string> = { facil: "Fácil", medio: "Média", dificil: "Difícil" };

export const TIPOS_QUESTAO = ["certo_errado", "multipla"] as const;
export type TipoQuestao = (typeof TIPOS_QUESTAO)[number];
export const ROTULO_TIPO_QUESTAO: Record<TipoQuestao, string> = { certo_errado: "Certo/Errado", multipla: "Múltipla escolha" };

export function lerDificuldades(valor: string | string[] | undefined): DificuldadeFiltro[] {
  const lista = Array.isArray(valor) ? valor : valor ? [valor] : [];
  return DIFICULDADES_FILTRO.filter((d) => lista.includes(d));
}

export function lerTipoQuestao(valor: string | undefined): TipoQuestao | undefined {
  return (TIPOS_QUESTAO as readonly string[]).includes(valor ?? "") ? (valor as TipoQuestao) : undefined;
}

/**
 * Certo ou errado (estilo Cebraspe) chega como duas alternativas, "Certo" e "Errado" (docs/FORMATO-QUESTOES.md).
 * Mesma regra do filtro em SQL (src/server/questoes.ts) e da contagem "q:ce".
 */
export function ehCertoErrado(alternativas: { texto: string }[]) {
  return alternativas.length === 2 && alternativas.some((a) => a.texto.trim().toLowerCase() === "certo");
}

/**
 * Seleção de conteúdo: uma ou várias matérias, cada uma inteira (assuntoIds vazio) ou só com algumas áreas.
 * Na URL: ?disciplina=1&disciplina=5&assunto=80 (a área diz de qual matéria é; matéria sem área marcada vai inteira).
 */
export type GrupoSelecao = { disciplinaId: number; assuntoIds: number[] };

export function lerSelecao(sp: { disciplina?: string | string[]; assunto?: string | string[] }) {
  return { disciplinas: lerIds(sp.disciplina), assuntos: lerIds(sp.assunto) };
}

/** Grupos de volta para a URL (mesmo formato que lerSelecao entende). */
export function parametrosSelecao(grupos: GrupoSelecao[], p = new URLSearchParams()) {
  for (const g of grupos) {
    p.append("disciplina", String(g.disciplinaId));
    for (const a of g.assuntoIds) p.append("assunto", String(a));
  }
  return p;
}
