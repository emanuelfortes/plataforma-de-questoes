// Patentes do ranking: o aluno sobe de posto conforme resolve questões diferentes (placar.resolvidas).
// Praças usam divisas (setas), oficiais usam estrelas, como nas fardas.

export type Patente = {
  nome: string;
  /** Questões diferentes resolvidas para chegar a este posto. */
  minimo: number;
  insignia: { tipo: "barra" | "divisa" | "estrela"; quantidade: number };
};

export const PATENTES: Patente[] = [
  { nome: "Recruta", minimo: 0, insignia: { tipo: "barra", quantidade: 1 } },
  { nome: "Soldado", minimo: 25, insignia: { tipo: "divisa", quantidade: 1 } },
  { nome: "Cabo", minimo: 100, insignia: { tipo: "divisa", quantidade: 2 } },
  { nome: "Sargento", minimo: 250, insignia: { tipo: "divisa", quantidade: 3 } },
  { nome: "Tenente", minimo: 500, insignia: { tipo: "estrela", quantidade: 1 } },
  { nome: "Capitão", minimo: 1000, insignia: { tipo: "estrela", quantidade: 2 } },
  { nome: "Major", minimo: 2000, insignia: { tipo: "estrela", quantidade: 3 } },
  { nome: "Coronel", minimo: 3500, insignia: { tipo: "estrela", quantidade: 4 } },
  { nome: "General", minimo: 6000, insignia: { tipo: "estrela", quantidade: 5 } },
];

/** Patente atual e a próxima (null no topo), com quanto falta e o progresso (0 a 1) até ela. */
export function patenteDe(resolvidas: number) {
  let i = 0;
  while (i + 1 < PATENTES.length && resolvidas >= PATENTES[i + 1]!.minimo) i++;
  const atual = PATENTES[i]!;
  const proxima = PATENTES[i + 1] ?? null;
  return {
    atual,
    proxima,
    faltam: proxima ? proxima.minimo - resolvidas : 0,
    progresso: proxima ? (resolvidas - atual.minimo) / (proxima.minimo - atual.minimo) : 1,
  };
}
