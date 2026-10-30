import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { contagens } from "@/db/schema";
import { chaveArtigo } from "@/lib/artigos-lei";
import sensiveis from "../../data/dispositivos-sensiveis.json";
import taxonomia from "../../data/taxonomia.json";

// Vade Mecum: o texto das leis (data/leis/<id>.txt, baixado do Planalto por scripts/leis/baixar-leis.ts,
// já sem os trechos revogados) desmontado em partes para a leitura guiada. Lê do disco e guarda na memória.

export type Selo = { tipo: "redacao" | "incluido" | "revogado"; norma: string; ano: number | null };

export type No =
  | { tipo: "titulo"; nivel: 1 | 2 | 3 | 4; rotulo: string; nome: string }
  | { tipo: "rubrica"; texto: string }
  | { tipo: "artigo"; numero: string; texto: string; selos: Selo[]; id: string }
  | { tipo: "paragrafo"; numero: string; texto: string; selos: Selo[] }
  | { tipo: "inciso"; numero: string; texto: string; selos: Selo[] }
  | { tipo: "alinea"; numero: string; texto: string; selos: Selo[] }
  | { tipo: "pena"; texto: string; selos: Selo[] }
  | { tipo: "texto"; texto: string; selos: Selo[] };

export type Secao = { indice: number; rotulo: string; nome: string; primeiro: string | null; ultimo: string | null; nos: No[] };
export type Lei = { id: string; nome: string; fonte: string; baixadaEm: string | null; secoes: Secao[] };

const LEIS = (taxonomia as { leis: Record<string, { nome: string; fonte: string }> }).leis;
const PASTA = path.join(process.cwd(), "data", "leis");

/** Nome da lei ("Código Penal (Decreto-Lei 2.848/1940)"), ou null se não existir. */
export function nomeDaLei(id: string) {
  return LEIS[id]?.nome ?? null;
}

/** Leis disponíveis (as que têm texto baixado), na ordem da taxonomia. */
export async function listarLeis() {
  const { readdir } = await import("node:fs/promises");
  const arquivos = new Set((await readdir(PASTA)).filter((a) => a.endsWith(".txt")).map((a) => a.slice(0, -4)));
  return Object.entries(LEIS)
    .filter(([id]) => arquivos.has(id))
    .map(([id, l]) => ({ id, nome: l.nome }));
}

// --- Notas do Planalto ("Redação dada pela Lei nº ...", "Incluído pela ...") viram selos -------------------

const NOTA = /\((?:[^()]|\([^()]*\))*?\b(Redação dada|Incluíd[oa]s?|Acrescid[oa]s?|Acrescentad[oa]s?|Revogad[oa]s?|Vide|Vigência|Renumerad[oa]s?|Regulamento|Promulgação|Execução suspensa|Produção de efeitos)\b(?:[^()]|\([^()]*\))*?\)/gi;
const SOLTAS = /\s*\b(Vigência|Vide [^.;]*?(?=$|\s\())\s*$/i;

function norma(texto: string) {
  const m = /(Lei Complementar|Lei|Decreto-Lei|Decreto|Emenda Constitucional(?: de Revisão)?|Medida Provisória)\s*n?[ºo°.]*\s*([\d.]+)/i.exec(texto);
  const ano = /\b(1[89]\d\d|20\d\d)\b/.exec(texto.slice(m?.index ?? 0));
  if (!m) return { norma: "", ano: ano ? Number(ano[1]) : null };
  const tipo = /emenda/i.test(m[1]!) ? "EC" : /complementar/i.test(m[1]!) ? "LC" : /decreto-lei/i.test(m[1]!) ? "DL" : /medida/i.test(m[1]!) ? "MP" : /decreto/i.test(m[1]!) ? "Decreto" : "Lei";
  return { norma: `${tipo} ${m[2]!.replace(/\.$/, "")}${ano ? `/${ano[1]}` : ""}`, ano: ano ? Number(ano[1]) : null };
}

function tirarNotas(linha: string): { texto: string; selos: Selo[] } {
  const selos: Selo[] = [];
  let texto = linha.replace(NOTA, (nota, tipo: string) => {
    const t = tipo.toLowerCase();
    const tipoSelo = t.startsWith("reda") ? "redacao" : /^(inclu|acresc)/.test(t) ? "incluido" : t.startsWith("revog") ? "revogado" : null;
    if (tipoSelo) selos.push({ tipo: tipoSelo, ...norma(nota) });
    return " ";
  });
  texto = texto.replace(SOLTAS, "").replace(/\s{2,}/g, " ").trim();
  // "I (revogado);" ou "§ 5º (Revogado)." sem mais nada: sobra só a pontuação. Mostra que foi revogado.
  if (/^[\s;.,:]*$/.test(texto) && selos.some((s) => s.tipo === "revogado")) texto = "(revogado)";
  return { texto, selos };
}

// --- Linha a linha -------------------------------------------------------------------------------------

const RE_TITULO = /^(PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O)\s+([IVXLCDM]+|[ÚU]NIC[OA]|GERAL|ESPECIAL|PRELIMINAR)?\b\.?\s*[-–]?\s*(.*)$/i;
// A letra do dispositivo vem colada ao número ("Art. 121-A", "§ 2º-B"). Com espaço ("Art. 313 - Apropriar-se",
// "§ 1º - A pena") é o separador seguido do texto: não pode virar "313-A" nem "1º-A". Pode haver mais de uma ("359-M-A").
const RE_ARTIGO = /^Art\.?\s*(\d+(?:\.\d+)?\s*[º°o]?(?:-[A-Z]{1,2}(?![a-zà-ú]))*)\s*\.?\s*[-–]?\s*(.*)$/;
const RE_PARAGRAFO = /^(?:§\s*(\d+\s*[º°o]?(?:-[A-Z](?![a-zà-ú]))?)\.?|[Pp]ar[áa]grafo [úu]nico\.?)\s*[-–.]?\s*(.*)$/;
const RE_INCISO = /^([IVXLCDM]+)\s*(?:[-–.]\s*|\s{2,}|\s(?=[a-zà-ú(]))(.*)$/;
const RE_ALINEA = /^([a-z])\)\s*(.*)$/;
const RE_PENA = /^Pena\s*[-–:]\s*(.*)$/i;
const NIVEL: Record<string, 1 | 2 | 3 | 4> = { PARTE: 1, LIVRO: 1, TITULO: 1, CAPITULO: 2, SECAO: 3, SUBSECAO: 4 };
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const numeroLimpo = (n: string) => n.replace(/\s+/g, "").replace(/o$/, "º").replace(/°/g, "º");

function interpretar(linhas: string[]): No[] {
  const nos: No[] = [];
  let artigos = 0;
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]!.trim();
    if (!linha || /^[.\s*]+$/.test(linha)) continue;

    const t = RE_TITULO.exec(linha);
    if (t && !/[a-z]{3}/.test(linha.slice(0, 12))) {
      const rotuloTipo = semAcento(t[1]!);
      let nome = t[3]!.trim();
      // "TÍTULO I" numa linha e o nome em maiúsculas na seguinte.
      if (!nome && linhas[i + 1] && /^[^a-z]{3,}$/.test(linhas[i + 1]!.trim()) && !RE_ARTIGO.test(linhas[i + 1]!.trim())) nome = linhas[++i]!.trim();
      nos.push({ tipo: "titulo", nivel: NIVEL[rotuloTipo] ?? 2, rotulo: `${t[1]!.trim()}${t[2] ? ` ${t[2]}` : ""}`.toUpperCase(), nome });
      continue;
    }
    const a = RE_ARTIGO.exec(linha);
    if (a) {
      const { texto, selos } = tirarNotas(a[2]!);
      const numero = numeroLimpo(a[1]!);
      nos.push({ tipo: "artigo", numero, texto, selos, id: `art-${numero.replace(/[º.]/g, "")}-${artigos++}` });
      continue;
    }
    const p = RE_PARAGRAFO.exec(linha);
    if (p) {
      const { texto, selos } = tirarNotas(p[2]!);
      nos.push({ tipo: "paragrafo", numero: p[1] ? `§ ${numeroLimpo(p[1])}` : "Parágrafo único", texto, selos });
      continue;
    }
    const pena = RE_PENA.exec(linha);
    if (pena) {
      const { texto, selos } = tirarNotas(pena[1]!);
      nos.push({ tipo: "pena", texto, selos });
      continue;
    }
    const inc = RE_INCISO.exec(linha);
    if (inc && nos.length) {
      const { texto, selos } = tirarNotas(inc[2]!);
      nos.push({ tipo: "inciso", numero: inc[1]!, texto, selos });
      continue;
    }
    const al = RE_ALINEA.exec(linha);
    if (al) {
      const { texto, selos } = tirarNotas(al[2]!);
      nos.push({ tipo: "alinea", numero: `${al[1]})`, texto, selos });
      continue;
    }
    const { texto, selos } = tirarNotas(linha);
    if (!texto && !selos.length) continue;
    // Linha curta, sem pontuação no fim: é o nome do dispositivo ("Homicídio simples", "Caso de diminuição de pena").
    if (texto.length <= 90 && !/[.;:,]$/.test(texto) && /^[A-ZÀ-Ú"“]/.test(texto) && !selos.some((s) => s.tipo === "revogado"))
      nos.push({ tipo: "rubrica", texto });
    else nos.push({ tipo: "texto", texto, selos });
  }
  return nos;
}

/**
 * Às vezes o Planalto deixa a redação antiga de um artigo, parágrafo, inciso ou alínea sem riscar, antes da nova
 * (ex.: dois "§ 1º" no mesmo artigo, dois "Art. 132" no ECA). Vale a última: a anterior sai, junto com o que
 * pertence só a ela.
 */
function removerRedacoesAntigas(nos: No[]): No[] {
  const remover = new Set<number>();
  // Artigo inteiro repetido: o anterior sai até o próximo artigo ou título (o nome do seguinte fica).
  const ultimoArtigo = new Map<string, number>();
  nos.forEach((no, i) => {
    if (no.tipo === "artigo") ultimoArtigo.set(no.numero, i);
  });
  nos.forEach((no, i) => {
    if (no.tipo !== "artigo" || ultimoArtigo.get(no.numero) === i) return;
    let j = i + 1;
    while (j < nos.length && nos[j]!.tipo !== "artigo" && nos[j]!.tipo !== "titulo") j++;
    while (j - 1 > i && nos[j - 1]!.tipo === "rubrica") j--;
    for (let k = i; k < j; k++) remover.add(k);
  });
  let vistos = new Map<string, number>();
  let paragrafo = "caput";
  let inciso = "";
  // Até onde vai um dispositivo: o próximo do mesmo nível ou de nível mais alto.
  const fimDe = (i: number) => {
    const tipo = nos[i]!.tipo;
    const para = tipo === "paragrafo" ? ["paragrafo", "artigo", "titulo"] : tipo === "inciso" ? ["inciso", "paragrafo", "artigo", "titulo"] : ["alinea", "inciso", "paragrafo", "artigo", "titulo"];
    let j = i + 1;
    while (j < nos.length && !para.includes(nos[j]!.tipo)) j++;
    // A pena e o nome do dispositivo seguinte, se vierem logo antes do próximo, ficam (não são só da redação antiga).
    while (j - 1 > i && (nos[j - 1]!.tipo === "pena" || nos[j - 1]!.tipo === "rubrica")) j--;
    return j;
  };
  nos.forEach((no, i) => {
    if (no.tipo === "artigo" || no.tipo === "titulo") {
      vistos = new Map();
      paragrafo = "caput";
      inciso = "";
      return;
    }
    let chave: string | null = null;
    if (no.tipo === "paragrafo") {
      paragrafo = no.numero;
      inciso = "";
      chave = `p:${no.numero}`;
    } else if (no.tipo === "inciso") {
      inciso = `${paragrafo}:${no.numero}`;
      chave = `i:${inciso}`;
    } else if (no.tipo === "alinea") {
      // Alínea direto no parágrafo (CP art. 7º, §§ 2º e 3º) é contada dentro dele.
      chave = `a:${inciso || paragrafo}:${no.numero}`;
    }
    if (!chave) return;
    const anterior = vistos.get(chave);
    if (anterior !== undefined) for (let k = anterior; k < fimDe(anterior); k++) remover.add(k);
    vistos.set(chave, i);
  });
  return remover.size ? nos.filter((_, i) => !remover.has(i)) : nos;
}

/** Corpo da lei: do primeiro título/artigo até antes das assinaturas e do aviso do Planalto. */
function recortarCorpo(conteudo: string) {
  // O Planalto usa o travessão do Windows (byte 0x96) em parte das leis: vira travessão normal.
  const linhas = conteudo
    .replace(/\r\n/g, "\n")
    .replace(/\u0096/g, "–")
    .split("\n")
    .filter((l) => !l.startsWith("#"));
  const ini = linhas.findIndex((l) => /^(PRE[ÂA]MBULO|PARTE |LIVRO |T[ÍI]TULO |CAP[ÍI]TULO |Art\.?\s*1\s*[º°o]?\b)/.test(l.trim()));
  // Um segundo cabeçalho do Planalto é outro documento colado no fim (ex.: promulgação das partes vetadas).
  let fim = linhas.findIndex((l, i) => i > ini && (/^Este texto não substitui/i.test(l.trim()) || l.trim() === "Presidência da República"));
  if (fim < 0) fim = linhas.length;
  // Assinatura: "Brasília, 27 de setembro de 2019; ..." e os nomes depois dela.
  const assinatura = linhas.slice(0, fim).findLastIndex((l) => /^(Brasília|Rio de Janeiro),?\s+\d/.test(l.trim()));
  if (assinatura > ini) fim = assinatura;
  return linhas.slice(Math.max(ini, 0), fim);
}

/** Divide em seções pelo nível de título mais alto que se repete (os Títulos, no Código Penal). */
function dividirEmSecoes(nos: No[]): Secao[] {
  const niveis = [1, 2] as const;
  const nivel = niveis.find((n) => nos.filter((x) => x.tipo === "titulo" && x.nivel === n).length >= 2);
  const secoes: Secao[] = [];
  let atual: Secao = { indice: 0, rotulo: "Início", nome: "", primeiro: null, ultimo: null, nos: [] };
  const fechar = () => {
    if (atual.nos.length) secoes.push({ ...atual, indice: secoes.length });
  };
  for (const no of nos) {
    if (nivel && no.tipo === "titulo" && no.nivel <= nivel && atual.nos.some((x) => x.tipo === "artigo")) {
      fechar();
      atual = { indice: 0, rotulo: no.rotulo, nome: no.nome, primeiro: null, ultimo: null, nos: [] };
    }
    // Antes do primeiro artigo, o nome da seção é o título mais próximo ("TÍTULO I", não "PARTE ESPECIAL").
    if (no.tipo === "titulo" && !atual.nos.some((x) => x.tipo === "artigo") && (!atual.nome || no.nivel <= (nivel ?? 2))) {
      atual.rotulo = no.rotulo;
      atual.nome = no.nome;
    }
    if (no.tipo === "artigo") {
      atual.primeiro ??= no.numero;
      atual.ultimo = no.numero;
    }
    atual.nos.push(no);
  }
  fechar();
  return secoes;
}

const cache = new Map<string, Lei>();

export async function carregarLei(id: string): Promise<Lei | null> {
  if (!/^[a-z0-9-]+$/.test(id) || !LEIS[id]) return null;
  const guardada = cache.get(id);
  if (guardada) return guardada;
  let conteudo: string;
  try {
    conteudo = await readFile(path.join(PASTA, `${id}.txt`), "utf8");
  } catch {
    return null;
  }
  const baixadaEm = /^# Baixado em:\s*(\d{4}-\d{2}-\d{2})/m.exec(conteudo)?.[1] ?? null;
  const lei: Lei = { id, nome: LEIS[id]!.nome, fonte: LEIS[id]!.fonte, baixadaEm, secoes: dividirEmSecoes(removerRedacoesAntigas(interpretar(recortarCorpo(conteudo)))) };
  cache.set(id, lei);
  return lei;
}

/** Seção que contém o artigo pedido ("121", "121-A", "5º"). */
export function secaoDoArtigo(lei: Lei, artigo: string) {
  const alvo = artigo.replace(/\s+/g, "").replace(/[º°o]$/i, "").toUpperCase();
  for (const s of lei.secoes)
    for (const n of s.nos)
      if (n.tipo === "artigo" && n.numero.replace(/º/g, "").toUpperCase() === alvo) return { secao: s.indice, id: n.id };
  return null;
}

// --- Ligações com o resto da plataforma ---------------------------------------------------------------

/** Quantas questões cobram cada artigo (de "contagens", chave "v:<lei>:<artigo>"). Só os artigos da seção. */
export async function questoesPorArtigo(lei: string, numeros: string[]) {
  const chaves = [...new Set(numeros.map((n) => `v:${lei}:${chaveArtigo(n)}`))];
  if (!chaves.length) return {} as Record<string, number>;
  const linhas = await db.select({ chave: contagens.chave, total: contagens.total }).from(contagens).where(inArray(contagens.chave, chaves));
  return Object.fromEntries(linhas.map((l) => [l.chave.slice(`v:${lei}:`.length), l.total]));
}

/** As partes de um só artigo (com o nome dele), para mostrar o texto oficial ao lado da explicação. */
export async function nosDoArtigo(leiId: string, artigo: string): Promise<No[]> {
  const lei = await carregarLei(leiId);
  const achado = lei && secaoDoArtigo(lei, artigo);
  if (!lei || !achado) return [];
  const nos = lei.secoes[achado.secao]!.nos;
  const i = nos.findIndex((n) => n.tipo === "artigo" && n.id === achado.id);
  let fim = nos.findIndex((n, k) => k > i && (n.tipo === "artigo" || n.tipo === "titulo"));
  if (fim < 0) fim = nos.length;
  if (nos[fim - 1]?.tipo === "rubrica") fim--; // nome do artigo seguinte
  return nos.slice(nos[i - 1]?.tipo === "rubrica" ? i - 1 : i, fim);
}

export type AvisoStf = { situacao: string; nota: string };

/** Artigos com decisão do STF ou não recepção (data/dispositivos-sensiveis.json), pela chave do artigo. */
export function avisosDaLei(lei: string): Record<string, AvisoStf> {
  const itens = (sensiveis as { itens: { lei: string; artigos: string[]; situacao: string; nota: string }[] }).itens;
  const avisos: Record<string, AvisoStf> = {};
  for (const it of itens) if (it.lei === lei) for (const a of it.artigos) avisos[chaveArtigo(a)] = { situacao: it.situacao, nota: it.nota };
  return avisos;
}
