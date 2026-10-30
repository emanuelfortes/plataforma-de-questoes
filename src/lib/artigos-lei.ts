// Quais artigos de lei uma questão cobra, para o Vade Mecum mostrar "N questões cobram este artigo".
// Lê só as fontes confiáveis: a referência legal da geração (lei_referencia) e a parte "Fundamento" do
// comentário. O resto do comentário cita artigos de passagem (para explicar alternativas erradas) e fica de fora.
import taxonomia from "../../data/taxonomia.json";
import { separarComentario } from "./comentario";

export type ArtigoCitado = { lei: string; artigo: string };

const IDS = Object.keys((taxonomia as { leis: Record<string, unknown> }).leis);

// Nomes e siglas das leis (as mais específicas primeiro: CPPM antes de CPP, CPM antes de CP).
const APELIDOS: [RegExp, string][] = [
  [/\bCPPM\b|C[óo]digo de Processo Penal Militar/i, "cppm"],
  [/\bCPP\b|C[óo]digo de Processo Penal/i, "cpp"],
  [/\bCPM\b|C[óo]digo Penal Militar/i, "cpm"],
  [/\bCTB\b|C[óo]digo de Tr[âa]nsito/i, "lei-9503-1997"],
  [/\bCP\b|C[óo]digo Penal/i, "cp"],
  [/\bCF\b|\bCF\/\d+|\bCRFB\b|Constitui[çc][ãa]o/i, "cf88"],
  [/\bECA\b|Estatuto da Crian[çc]a/i, "lei-8069-1990"],
  [/\bLEP\b|Lei de Execu[çc][ãa]o Penal/i, "lei-7210-1984"],
  [/Lei (?:das )?Contraven[çc][õo]es|Decreto-Lei\s*n?[ºo°.]*\s*3\.?688/i, "dl-3688-1941"],
];

// Matéria sem lei citada: a lei principal dela ("art. 121" numa questão de Direito Penal é do CP).
const LEI_DA_MATERIA: Record<string, string> = {
  "Direito Penal": "cp",
  "Direito Processual Penal": "cpp",
  "Direito Constitucional": "cf88",
  "Direito Penal Militar": "cpm",
  "Direito Processual Penal Militar": "cppm",
};

function leiDoTrecho(bruto: string): string | null {
  // "(redação dada pela Lei 13.964/2019)" fala de quem alterou, não da lei do artigo.
  const trecho = bruto.replace(/\([^)]*\b(reda[çc][ãa]o|inclu[íi]d|acrescid|acrescentad|alterad|pela|pelo)\b[^)]*\)/gi, " ");
  const numero = /\bLei(?:\s+Complementar)?\s*(?:n[ºo°.]*\s*)?(\d{1,2}\.?\d{3})\b/i.exec(trecho);
  if (numero) {
    const n = numero[1]!.replace(".", "");
    const id = IDS.find((i) => i.startsWith(`lei-${n}-`));
    if (id) return id;
  }
  for (const [re, id] of APELIDOS) if (re.test(trecho)) return id;
  return null;
}

const normalizar = (n: string, letra?: string) => `${Number(n)}${letra ? `-${letra.toUpperCase()}` : ""}`;

function artigosDoTrecho(trecho: string): string[] {
  const achados: string[] = [];
  // "art. 121", "art. 121-A", "artigo 5º"
  for (const m of trecho.matchAll(/\bart(?:igo)?\.?\s*(\d{1,4})\s*[º°o]?(?:\s*-\s*([A-Z])\b)?/gi)) achados.push(normalizar(m[1]!, m[2]));
  // "arts. 155 e 157", "arts. 312, 313 e 316"
  for (const m of trecho.matchAll(/\barts\.?\s*((?:\d{1,4}\s*[º°o]?(?:-[A-Z])?\s*(?:,|e)\s*)+\d{1,4}\s*[º°o]?(?:-[A-Z])?)/gi))
    for (const n of m[1]!.matchAll(/(\d{1,4})\s*[º°o]?(?:-([A-Z]))?/g)) achados.push(normalizar(n[1]!, n[2]));
  return achados;
}

/** Artigos que a questão cobra, sem repetição. Lista vazia quando não dá para saber. */
export function artigosDaQuestao(q: { disciplina: string; leiReferencia?: string | null; comentario?: string | null }): ArtigoCitado[] {
  const fontes = [
    q.leiReferencia ?? "",
    ...(q.comentario ? separarComentario(q.comentario).filter((p) => p.tipo === "lei").map((p) => (p.tipo === "lei" ? p.texto : "")) : []),
  ].filter(Boolean);
  const vistos = new Map<string, ArtigoCitado>();
  for (const fonte of fontes) {
    // Cada trecho separado por ";" pode ser de uma lei diferente ("art. 5º da CF; art. 301 do CPP").
    for (const trecho of fonte.split(/;/)) {
      const lei = leiDoTrecho(trecho) ?? leiDoTrecho(fonte) ?? LEI_DA_MATERIA[q.disciplina] ?? null;
      if (!lei) continue;
      for (const artigo of artigosDoTrecho(trecho)) vistos.set(`${lei}:${artigo}`, { lei, artigo });
    }
  }
  return [...vistos.values()];
}

/** Chave do artigo como o Vade Mecum mostra ("121", "121-A", "5"). */
export function chaveArtigo(numero: string) {
  const m = /(\d{1,4})\s*[º°o]?(?:\s*-\s*([A-Z]))?/i.exec(numero);
  return m ? normalizar(m[1]!, m[2]) : numero;
}
