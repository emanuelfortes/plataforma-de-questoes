// Chaves da tabela "contagens" (totais prontos: nunca COUNT(*) em questoes numa requisição).
// Uma regra só para a importação, a aprovação, o reporte (src/db/aprovacao.ts) e a recontagem (scripts/lib/recontar.ts).
//
//   q:total, q:d:<matéria>, q:a:<área>              todas as questões no ar
//   <escopo>:n<1|2|3>                               por dificuldade (fácil, médio, difícil)
//   <escopo>:ce                                     certo ou errado
//   <escopo>:n<1|2|3>:ce                            certo ou errado de uma dificuldade
// Escopo: "q" (o banco todo), "q:d:<matéria>" ou "q:a:<área>". Múltipla escolha = total menos certo ou errado.
import { ehCertoErrado, type DificuldadeFiltro, type TipoQuestao } from "./filtros";
import { NIVEL_DIFICULDADE } from "./dificuldade";

type Item = {
  disciplinaId: number;
  assuntoId: number | null;
  /** Só questões: 1, 2 ou 3 (nulo = sem nível). */
  dificuldade?: number | null;
  alternativas?: { texto: string }[];
};

/** Todas as chaves em que um item entra (para somar 1 ao entrar no ar e tirar 1 ao sair). */
export function chavesDoItem(prefixo: "q" | "f", item: Item): string[] {
  const chaves = [`${prefixo}:total`, `${prefixo}:d:${item.disciplinaId}`, ...(item.assuntoId ? [`${prefixo}:a:${item.assuntoId}`] : [])];
  if (prefixo === "f") return chaves;
  const escopos = ["q", `q:d:${item.disciplinaId}`, ...(item.assuntoId ? [`q:a:${item.assuntoId}`] : [])];
  const nivel = item.dificuldade && item.dificuldade >= 1 && item.dificuldade <= 3 ? item.dificuldade : null;
  const ce = !!item.alternativas && ehCertoErrado(item.alternativas);
  for (const e of escopos) {
    if (nivel) chaves.push(`${e}:n${nivel}`);
    if (ce) chaves.push(`${e}:ce`);
    if (nivel && ce) chaves.push(`${e}:n${nivel}:ce`);
  }
  return chaves;
}

/**
 * Total de questões no ar para um filtro (escopos + dificuldade + tipo), só com somas e subtrações
 * de chaves prontas. Devolve as chaves a ler e a conta a fazer com elas.
 */
export function totalDoFiltro(escopos: string[], dificuldades: DificuldadeFiltro[], tipo: TipoQuestao | undefined) {
  const niveis = dificuldades.length && dificuldades.length < 3 ? dificuldades.map((d) => NIVEL_DIFICULDADE[d]) : [];
  const base = (e: string) => (e === "q" ? "q:total" : e);
  // Para cada escopo: as partes que somam (todas, ou só as do nível) e as de certo ou errado correspondentes.
  const partes = escopos.flatMap((e) =>
    niveis.length ? niveis.map((n) => ({ todas: `${e}:n${n}`, ce: `${e}:n${n}:ce` })) : [{ todas: base(e), ce: `${e}:ce` }],
  );
  const chaves = [...new Set(partes.flatMap((p) => [p.todas, p.ce]))];
  const calcular = (lido: Map<string, number>) =>
    partes.reduce((soma, p) => {
      const todas = lido.get(p.todas) ?? 0;
      const ce = lido.get(p.ce) ?? 0;
      return soma + (tipo === "certo_errado" ? ce : tipo === "multipla" ? Math.max(todas - ce, 0) : todas);
    }, 0);
  return { chaves, calcular };
}
