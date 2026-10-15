// Nomes de matérias e áreas. A IA identifica a matéria e as áreas a partir do PDF (não de uma
// lista fechada); aqui os nomes são padronizados para não virar bagunça:
// - data/catalogo.json traz os nomes preferidos (e apelidos de matérias, ex.: "Português").
// - chaveNome() ignora maiúsculas, acentos, plural, pontuação e "de/da/do", então
//   "Substantivos" e "substantivo" são a mesma área.
import dados from "../../data/catalogo.json";

export type MateriaCatalogo = { nome: string; apelidos?: string[]; assuntos: string[] };

export const CATALOGO: MateriaCatalogo[] = dados.disciplinas;

export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "no", "na"]);

/** Singular aproximado do português (já sem acentos). Basta ser igual dos dois lados da comparação. */
function singular(p: string) {
  if (p.length <= 3 || !p.endsWith("s")) return p;
  if (p.endsWith("oes") || p.endsWith("aes")) return `${p.slice(0, -3)}ao`; // funções, pães
  if (p.endsWith("ais")) return `${p.slice(0, -3)}al`; // patrimoniais
  if (p.endsWith("eis")) return `${p.slice(0, -3)}el`; // níveis, papéis
  if (p.endsWith("ois")) return `${p.slice(0, -3)}ol`; // anzóis
  if (p.endsWith("ns")) return `${p.slice(0, -2)}m`; // homens
  if (p.length > 4 && /(r|z|s)es$/.test(p)) return p.slice(0, -2); // fatores, vezes, meses
  return p.slice(0, -1); // substantivos
}

/** Chave de comparação: dois nomes com a mesma chave são a mesma matéria/área. */
export function chaveNome(texto: string) {
  return normalizar(texto)
    .replace(/[^a-z0-9º° ]+/g, " ")
    .split(" ")
    .filter((p) => p && !PALAVRAS_VAZIAS.has(p))
    .map(singular)
    .join(" ");
}

/** Limpa espaços e põe a primeira letra maiúscula, mantendo o resto como veio. */
export function limparNome(texto: string) {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const materiasPorChave = new Map<string, MateriaCatalogo>();
for (const m of CATALOGO) {
  for (const nome of [m.nome, ...(m.apelidos ?? [])]) materiasPorChave.set(chaveNome(nome), m);
}

/** Nome preferido da matéria e da área (do catálogo, se houver), ou o nome recebido, limpo. */
export function nomesPreferidos(disciplina: string, assunto: string | undefined) {
  const m = materiasPorChave.get(chaveNome(disciplina));
  const nomeDisciplina = m?.nome ?? limparNome(disciplina);
  if (assunto === undefined) return { disciplina: nomeDisciplina, assunto: undefined };
  const chave = chaveNome(assunto);
  const oficial = m?.assuntos.find((a) => chaveNome(a) === chave);
  return { disciplina: nomeDisciplina, assunto: oficial ?? limparNome(assunto) };
}

/** Semelhança entre 0 e 1 (pares de letras em comum). Usada só para avisar "parece com...". */
export function semelhanca(a: string, b: string) {
  const pares = (t: string) => {
    const s = chaveNome(t).replace(/ /g, "");
    return Array.from({ length: Math.max(s.length - 1, 0) }, (_, i) => s.slice(i, i + 2));
  };
  const pa = pares(a);
  const pb = pares(b);
  if (!pa.length || !pb.length) return 0;
  const resto = [...pb];
  let comuns = 0;
  for (const p of pa) {
    const i = resto.indexOf(p);
    if (i >= 0) {
      comuns++;
      resto.splice(i, 1);
    }
  }
  return (2 * comuns) / (pa.length + pb.length);
}
