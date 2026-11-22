// Nível de dificuldade da questão. Compartilhado entre servidor, cliente e scripts.
// No banco é um inteiro (1, 2, 3) para ordenar e indexar; no JSONL é o texto.

export const DIFICULDADES = ["facil", "medio", "dificil"] as const;
export type Dificuldade = (typeof DIFICULDADES)[number];

export const ROTULO_DIFICULDADE: Record<Dificuldade, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

export const NIVEL_DIFICULDADE: Record<Dificuldade, number> = { facil: 1, medio: 2, dificil: 3 };

/**
 * Mistura de níveis na lista de questões do aluno: a cada 10 questões, 5 fáceis, 3 médias e 2 difíceis.
 * Quando um nível acaba (ou não está no filtro), os outros completam a página na mesma proporção entre si.
 * A chave 0 é a questão sem nível (entra como média).
 */
export const PESO_NIVEL: Record<0 | 1 | 2 | 3, number> = { 1: 5, 2: 3, 3: 2, 0: 3 };

export function dificuldadePorNivel(nivel: number | null | undefined): Dificuldade | null {
  return DIFICULDADES[(nivel ?? 0) - 1] ?? null;
}
