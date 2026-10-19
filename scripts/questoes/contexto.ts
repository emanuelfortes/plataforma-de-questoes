// Monta o contexto de geração de cada tópico: parâmetros (disciplina, banca, cargo, formato...)
// e o texto legal aplicável, só com os artigos do tópico quando a lei é grande.
import { existsSync, readFileSync } from "node:fs";
import type { DispositivoSensivel, Julgado } from "./esquema";

export type Formato = { banca: string; alternativas: number; concursos: string[]; meta: number };
export type Trecho = { lei: string; de: number; ate: number };
export type Topico = {
  id: string;
  nome: string;
  concursos: string[];
  meta: number;
  subtopicos: string[];
  leis: string[];
  trechos: Trecho[];
  formatos: Formato[];
  nota?: string;
};
export type Concurso = { id: string; nome: string; orgao: string; cargo: string; banca: string; alternativas: number; edicao?: string };
export type Taxonomia = {
  concursos: Concurso[];
  disciplinas: { nome: string; topicos: Topico[] }[];
  leis: Record<string, { nome: string; fonte: string; observacao?: string }>;
};

export function lerTaxonomia(): Taxonomia {
  return JSON.parse(readFileSync("data/taxonomia.json", "utf8"));
}

export function acharTopico(tax: Taxonomia, id: string) {
  for (const d of tax.disciplinas) {
    const t = d.topicos.find((x) => x.id === id);
    if (t) return { disciplina: d.nome, topico: t };
  }
  throw new Error(`Tópico não encontrado na taxonomia: ${id}`);
}

const numeroArtigo = (linha: string) => {
  const m = /^Art\. (\d+)/.exec(linha);
  return m ? Number(m[1]) : null;
};

/**
 * Artigos [de, ate] de uma lei (inclui os "-A", "-B"...). Usa a primeira ocorrência de "Art. de",
 * que é o texto principal (na CF, o ADCT repete os números no fim).
 */
export function extrairArtigos(texto: string, de: number, ate: number) {
  const linhas = texto.split("\n");
  const inicio = linhas.findIndex((l) => numeroArtigo(l) === de);
  if (inicio < 0) throw new Error(`Art. ${de} não encontrado`);
  let fim = linhas.length;
  for (let i = inicio + 1; i < linhas.length; i++) {
    const n = numeroArtigo(linhas[i]!);
    if (n !== null && (n > ate || n < de)) {
      fim = i;
      break;
    }
  }
  return linhas.slice(inicio, fim).join("\n").trim();
}

function lerLei(id: string) {
  const caminho = `data/leis/${id}.txt`;
  if (!existsSync(caminho)) throw new Error(`Texto da lei ausente: ${caminho} (baixe com scripts/leis/baixar-leis.ts ou salve à mão)`);
  return readFileSync(caminho, "utf8");
}

/** Leis cujo texto vai no contexto do tópico (inteiras ou em trechos). */
export const leisDoTopico = (topico: Topico) => [...new Set([...topico.leis, ...topico.trechos.map((t) => t.lei)])];

/** Julgados que podem ser citados pelo número (data/jurisprudencia.json, preenchido pelo professor). */
export function lerJurisprudencia(): Julgado[] {
  return JSON.parse(readFileSync("data/jurisprudencia.json", "utf8")).itens;
}

/** Dispositivos com ressalva obrigatória (data/dispositivos-sensiveis.json) que valem para as leis do tópico. */
export function sensiveisDoTopico(topico: Topico): DispositivoSensivel[] {
  const leis = new Set(leisDoTopico(topico));
  const itens: DispositivoSensivel[] = JSON.parse(readFileSync("data/dispositivos-sensiveis.json", "utf8")).itens;
  return itens.filter((d) => leis.has(d.lei));
}

/** Texto legal do tópico: trechos indicados ou, sem trecho, as leis inteiras. Vazio para disciplinas sem lei. */
export function textoLegal(tax: Taxonomia, topico: Topico) {
  const blocos: string[] = [];
  const comTrecho = new Set(topico.trechos.map((t) => t.lei));
  for (const t of topico.trechos) {
    const lei = tax.leis[t.lei]!;
    blocos.push(`=== ${lei.nome}: arts. ${t.de} a ${t.ate} (texto compilado vigente) ===\n${extrairArtigos(lerLei(t.lei), t.de, t.ate)}`);
  }
  for (const id of topico.leis) {
    if (comTrecho.has(id)) continue;
    const lei = tax.leis[id]!;
    blocos.push(`=== ${lei.nome} (texto compilado integral vigente) ===\n${lerLei(id).replace(/^#.*\n/gm, "").trim()}`);
  }
  return blocos.join("\n\n");
}
