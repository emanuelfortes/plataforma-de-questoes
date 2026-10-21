// Ordem, pastas e classificação das áreas (data/ordem-areas.json). Usado pela tela de filtro,
// pela importação e por scripts/publicacao/reclassificar-crimes.ts.
import ordemAreas from "../../data/ordem-areas.json";
import { chaveNome } from "./catalogo";

/** Área que a importação consegue preencher sozinha: pelos artigos do CP citados ou pelo nome do crime. */
export type AreaClassificada = { area: string; artigos: string[]; termos?: string; exceto?: string };
export type EntradaOrdem = string | AreaClassificada | { pasta: string; areas: EntradaOrdem[] };

const POR_MATERIA = new Map(
  Object.entries(ordemAreas as Record<string, unknown>)
    .filter((par): par is [string, EntradaOrdem[]] => Array.isArray(par[1]))
    .map(([materia, entradas]) => [chaveNome(materia), entradas]),
);

export function entradasDaMateria(materia: string): EntradaOrdem[] {
  return POR_MATERIA.get(chaveNome(materia)) ?? [];
}

export const nomeDaEntrada = (e: EntradaOrdem) => (typeof e === "string" ? e : "pasta" in e ? e.pasta : e.area);

// --- Classificação ---------------------------------------------------------------------------

/** "124-128" vira 124..128; "121-A" fica como está. */
function expandirArtigos(artigos: string[]) {
  return artigos.flatMap((a) => {
    const m = /^(\d+)-(\d+)$/.exec(a);
    if (!m) return [a.toUpperCase()];
    const lista: string[] = [];
    for (let n = Number(m[1]); n <= Number(m[2]); n++) lista.push(String(n));
    return lista;
  });
}

type Folha = { area: string; artigos: Set<string>; termos?: RegExp; exceto?: RegExp };
type Base = { area: string; folhas: Folha[] };

/** Para cada área "base" (a do título, ex.: Crimes contra a Pessoa), as áreas de crime da pasta dela. */
function montarBases(entradas: EntradaOrdem[]): Base[] {
  const bases: Base[] = [];
  const folhasDe = (lista: EntradaOrdem[]): Folha[] =>
    lista.flatMap((e) => {
      if (typeof e === "string") return [];
      if ("pasta" in e) return folhasDe(e.areas);
      return [
        {
          area: e.area,
          artigos: new Set(expandirArtigos(e.artigos)),
          termos: e.termos ? new RegExp(e.termos, "i") : undefined,
          exceto: e.exceto ? new RegExp(e.exceto, "i") : undefined,
        },
      ];
    });
  const visitar = (lista: EntradaOrdem[]) => {
    for (const e of lista) {
      if (typeof e === "string" || !("pasta" in e)) continue;
      const temBase = e.areas.some((x) => typeof x === "string" && chaveNome(x) === chaveNome(e.pasta));
      if (temBase) bases.push({ area: e.pasta, folhas: folhasDe(e.areas) });
      else visitar(e.areas);
    }
  };
  visitar(entradas);
  return bases;
}

const BASES = new Map([...POR_MATERIA].map(([materia, entradas]) => [materia, montarBases(entradas)]));

// "art. 121", "arts. 155 e 157", "artigo 121-A". Ignora o que vem seguido de outra lei (CPP, CF, CTB, Lei nº...).
const CITACAO = /\bart(?:igo)?s?\.?\s*(\d{1,3}(?:-[a-z])?)\b(?!\s*,?\s*(?:§[^,;]*,?\s*)?(?:d[aoe]s?\s+)?(?:cpp|cf\b|ctb|constitui|lei\b|lep\b|eca\b|c[óo]digo de processo|estatuto))/gi;

function artigosCitados(texto: string | null | undefined) {
  if (!texto) return [];
  return [...texto.matchAll(CITACAO)].map((m) => m[1]!.toUpperCase());
}

/** lei_referencia: só vale se for do CP (ex.: "CP, art. 157"). */
function artigosDaLei(lei: string | null | undefined) {
  if (!lei || /\blei\b|cpp|\bcf\b|ctb|constitui/i.test(lei)) return [];
  return [...lei.matchAll(/art(?:igo)?s?\.?\s*(\d{1,3}(?:-[a-z])?)/gi)].map((m) => m[1]!.toUpperCase());
}

function unica<T>(lista: T[]) {
  const s = [...new Set(lista)];
  return s.length === 1 ? s[0] : undefined;
}

export type TextosClassificacao = {
  /** Enunciado (questão) ou frente (flashcard). */
  principal: string;
  /** Texto da alternativa correta (questão) ou verso (flashcard). */
  correta?: string;
  /** Comentário e demais alternativas. */
  resto?: string;
  leiReferencia?: string | null;
};

/**
 * Área de crime para uma questão que está (ou chega) na área do título, como "Crimes contra a Pessoa".
 * Devolve o nome da área (ex.: "Feminicídio") ou undefined quando não dá para decidir com segurança
 * (aí ela fica na área do título, que aparece como "Demais ...").
 */
export function classificarArea(materia: string, area: string | null | undefined, t: TextosClassificacao) {
  if (!area) return undefined;
  const base = BASES.get(chaveNome(materia))?.find((b) => chaveNome(b.area) === chaveNome(area));
  if (!base) return undefined;

  const porArtigo = (arts: string[]) => unica(base.folhas.filter((f) => arts.some((a) => f.artigos.has(a))).map((f) => f.area));
  const porTermo = (texto: string | undefined) => {
    if (!texto) return [];
    return base.folhas.filter((f) => f.termos?.test(texto) && !f.exceto?.test(texto)).map((f) => f.area);
  };

  // 1. Dispositivo informado pela geração (o mais confiável).
  const lei = artigosDaLei(t.leiReferencia);
  if (lei.length) {
    const r = porArtigo(lei);
    if (r) return r;
  }
  // 2. Artigo citado no enunciado.
  const r2 = porArtigo(artigosCitados(t.principal));
  if (r2) return r2;
  // 3. Nome do crime no enunciado (se só um crime aparece).
  const termos = porTermo(t.principal);
  if (termos.length === 1) return termos[0];
  // 4. A alternativa correta ("Houve roubo consumado...") ou o verso do flashcard.
  const r4 = porArtigo(artigosCitados(t.correta)) ?? unica(porTermo(t.correta));
  if (r4 && (termos.length === 0 || termos.includes(r4))) return r4;
  // 5. Artigos citados no comentário, se apontam para um crime só (e combinam com o enunciado, se ele citou algum).
  const r5 = porArtigo(artigosCitados(t.resto));
  if (r5 && (termos.length === 0 || termos.includes(r5))) return r5;
  return undefined;
}

/** Áreas de título que têm crimes classificáveis dentro (ex.: "Crimes contra a Pessoa"). */
export function areasBase(materia: string) {
  return (BASES.get(chaveNome(materia)) ?? []).map((b) => b.area);
}
