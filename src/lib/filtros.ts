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
export const MAX_AREAS = 30;
export function lerIds(valor: string | string[] | undefined) {
  const lista = Array.isArray(valor) ? valor : valor ? [valor] : [];
  const ids = lista.map(lerId).filter((n): n is number => n !== undefined);
  return [...new Set(ids)].slice(0, MAX_AREAS);
}
