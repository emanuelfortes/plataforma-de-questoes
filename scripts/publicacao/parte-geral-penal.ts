// Reorganiza as áreas da Parte Geral do Direito Penal (a partir de Consumação) na lista e na ordem do professor,
// que segue o Código Penal: separa as áreas que juntavam vários temas (Consumação, Tentativa e Desistência;
// Ilicitude e Excludentes; Culpabilidade e Imputabilidade; Ação Penal, Punibilidade e Prescrição...) e junta as
// repetidas (Crime Consumado e Tentativa). A ordem na tela vem de data/ordem-areas.json.
//
// Cada questão vai para a área do artigo do CP que ela cobra (tabela artigos_questao): art. 14 Consumação ou
// Tentativa, 15 Desistência Voluntária e Arrependimento Eficaz, 16 Arrependimento Posterior, 17 Crime Impossível...
// Onde o mesmo artigo tem dois temas (14, 18, 20 e 22), decide o inciso citado no comentário e as palavras do texto.
// Mesmo id: o histórico dos alunos não muda, só a área. As áreas antigas ficam vazias e somem da tela.
//
//   npx tsx scripts/publicacao/parte-geral-penal.ts             só lista (grava data/publicacao/parte-geral-penal.json)
//   npx tsx scripts/publicacao/parte-geral-penal.ts --aplicar   move e recalcula as contagens
//
// Antes de aplicar: npx tsx scripts/publicacao/backup-producao.ts parte-geral-penal
import "../_env";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Db } from "../../src/db";
import * as schema from "../../src/db/schema";
import { recontar } from "../lib/recontar";

const APLICAR = process.argv.includes("--aplicar");
const url = process.env.TURSO_DATABASE_URL ?? "";
if (!url.startsWith("libsql://")) throw new Error("TURSO_DATABASE_URL não é um banco Turso");
const prod = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

// Áreas de onde as questões saem (as que juntavam temas e as repetidas).
const FONTES = [
  "Consumação, Tentativa e Desistência",
  "Crime Consumado e Tentativa",
  "Desistência Voluntária, Arrependimento Eficaz e Arrependimento Posterior",
  "Crime Doloso, Culposo e Agravação pelo Resultado",
  "Erro de Tipo e Descriminantes Putativas",
  "Coação Irresistível e Obediência Hierárquica",
  "Ilicitude e Excludentes",
  "Culpabilidade e Imputabilidade",
  "Ação Penal, Punibilidade e Prescrição",
];

// Áreas de destino (nomes exatos de data/ordem-areas.json).
const A = {
  causalidade: "Relação de Causalidade",
  consumacao: "Consumação",
  tentativa: "Tentativa",
  desistencia: "Desistência Voluntária e Arrependimento Eficaz",
  arrependimento: "Arrependimento Posterior",
  impossivel: "Crime Impossível",
  dolo: "Dolo",
  culpa: "Culpa",
  agravacao: "Agravação pelo Resultado",
  erroTipo: "Erro de Tipo",
  putativas: "Descriminantes Putativas",
  erroProibicao: "Erro de Proibição",
  coacao: "Coação Moral Irresistível",
  obediencia: "Obediência Hierárquica",
  excludentes: "Excludentes de Ilicitude",
  necessidade: "Estado de Necessidade",
  legitima: "Legítima Defesa",
  doenca: "Inimputabilidade por Doença Mental",
  menoridade: "Menoridade Penal",
  embriaguez: "Emoção, Paixão e Embriaguez",
  acaoPenal: "Ação Penal",
  extincao: "Extinção da Punibilidade",
  prescricao: "Prescrição",
  aplicacao: "Aplicação da Lei Penal",
  penas: "Penas e Medidas de Segurança",
  concursoPessoas: "Concurso de Pessoas",
  concursoCrimes: "Concurso de Crimes",
} as const;
type Destino = (typeof A)[keyof typeof A];

const n = (a: string) => Number(a.replace(/-.*/, ""));

/** Área de um artigo do CP (sem olhar o texto). null = artigo fora da Parte Geral tratada aqui. */
function areaDoArtigo(artigo: string): Destino | "14" | "18" | "20" | "22" | null {
  const x = n(artigo);
  if (x >= 1 && x <= 12) return A.aplicacao;
  if (x === 13) return A.causalidade;
  if (x === 14 || x === 18 || x === 20 || x === 22) return String(x) as "14" | "18" | "20" | "22";
  if (x === 15) return A.desistencia;
  if (x === 16) return A.arrependimento;
  if (x === 17) return A.impossivel;
  if (x === 19) return A.agravacao;
  if (x === 21) return A.erroProibicao;
  if (x === 23) return A.excludentes;
  if (x === 24) return A.necessidade;
  if (x === 25) return A.legitima;
  if (x === 26) return A.doenca;
  if (x === 27 || x === 228) return A.menoridade; // 228: o da CF (menor de 18), às vezes marcado como CP
  if (x === 28) return A.embriaguez;
  if (x >= 29 && x <= 31) return A.concursoPessoas;
  if (x >= 32 && x <= 68) return A.penas;
  if (x >= 69 && x <= 76) return A.concursoCrimes;
  if (x >= 77 && x <= 99) return A.penas;
  if (x >= 100 && x <= 106) return A.acaoPenal;
  if (x === 107 || x === 108 || x === 120) return A.extincao;
  if (x >= 109 && x <= 119) return A.prescricao;
  return null;
}

const conta = (texto: string, re: RegExp) => (texto.match(re) ?? []).length;

/** Artigos de dois temas: o inciso citado decide; senão, as palavras do texto. */
function desempatar(art: "14" | "18" | "20" | "22", texto: string): Destino | null {
  const t = texto.toLowerCase();
  if (art === "14") {
    if (/art\.?\s*14,?\s*(?:inciso\s*)?ii\b|par[aá]grafo [uú]nico do art\.?\s*14|art\.?\s*14,?\s*par[aá]grafo [uú]nico/.test(t)) return A.tentativa;
    if (/art\.?\s*14,?\s*(?:inciso\s*)?i\b(?!i)/.test(t)) return A.consumacao;
    const tent = conta(t, /tentativ|tentad|cruenta|branca|imperfeita|inacabada|perfeita|acabada|circunst[âa]ncias alheias|iter criminis/g);
    const cons = conta(t, /consuma|consumad|exaurimento|reuniu todos os elementos|re[uú]nem todos os elementos/g);
    if (tent > cons) return A.tentativa;
    if (cons > tent) return A.consumacao;
    return null;
  }
  if (art === "18") {
    if (/art\.?\s*18,?\s*(?:inciso\s*)?ii\b|par[aá]grafo [uú]nico do art\.?\s*18/.test(t)) return A.culpa;
    if (/art\.?\s*18,?\s*(?:inciso\s*)?i\b(?!i)/.test(t)) return A.dolo;
    const culpa = conta(t, /culp|imprud|neglig|imper[ií]cia|previsibilidade|dever de cuidado/g);
    const dolo = conta(t, /dolo|doloso|dolosa|assumiu o risco|quis o resultado/g);
    if (culpa > dolo) return A.culpa;
    if (dolo > culpa) return A.dolo;
    return null;
  }
  if (art === "20") {
    if (/putativ|art\.?\s*20,?\s*§\s*1/.test(t)) return A.putativas;
    return A.erroTipo;
  }
  // 22: coação moral irresistível x obediência hierárquica
  const obed = conta(t, /obedi[êe]ncia|hier[áa]rquic|superior|ordem n[ãa]o manifestamente/g);
  const coac = conta(t, /coa[çc][ãa]o|coagid|coator|amea[çc]/g);
  if (obed > coac) return A.obediencia;
  if (coac > obed) return A.coacao;
  return null;
}

// Sem artigo do CP: palavras que só aparecem num tema.
const POR_PALAVRAS: [RegExp, Destino][] = [
  // Art. 23 lista todas as excludentes: vale antes de "estado de necessidade" e "legítima defesa".
  [/art\.?\s*23\b|n[ãa]o h[áa] crime quando o agente pratica o fato/i, A.excludentes],
  [/arrependimento posterior/i, A.arrependimento],
  [/desist[êe]ncia volunt[áa]ria|arrependimento eficaz/i, A.desistencia],
  [/crime imposs[íi]vel|tentativa inid[ôo]nea|crime oco/i, A.impossivel],
  [/tentativa (?:branca|cruenta|incruenta|perfeita|imperfeita|acabada|inacabada)|pune-se a tentativa/i, A.tentativa],
  [/descriminantes? putativ|legítima defesa putativa/i, A.putativas],
  [/erro (?:de|sobre a) proibi[çc][ãa]o|erro sobre a ilicitude/i, A.erroProibicao],
  [/erro de tipo|erro sobre elemento/i, A.erroTipo],
  [/obedi[êe]ncia hier[áa]rquica/i, A.obediencia],
  [/coa[çc][ãa]o (?:moral )?irresist[íi]vel/i, A.coacao],
  [/estado de necessidade/i, A.necessidade],
  [/leg[íi]tima defesa/i, A.legitima],
  [/estrito cumprimento|exerc[íi]cio regular|excludentes? de ilicitude|excesso pun[íi]vel/i, A.excludentes],
  [/embriaguez|emo[çc][ãa]o ou a paix[ãa]o|actio libera/i, A.embriaguez],
  [/menores? de (?:18|dezoito)|menoridade/i, A.menoridade],
  [/doen[çc]a mental|desenvolvimento mental|semi-?imput[áa]vel|inimput[áa]vel/i, A.doenca],
  [/prescri[çc][ãa]o|prescreve/i, A.prescricao],
  [/extin[çc][ãa]o da punibilidade|extingue-se a punibilidade|perd[ãa]o judicial|abolitio|anistia|gra[çc]a|indulto/i, A.extincao],
  [/a[çc][ãa]o penal|queixa|representa[çc][ãa]o do ofendido|requisi[çc][ãa]o do ministro|decad[êe]ncia|perempção|renúncia ao direito de queixa/i, A.acaoPenal],
  [/preterdolos|agrava[çc][ãa]o pelo resultado|resultado que agrava/i, A.agravacao],
  [/dolo eventual|dolo direto|dolo indireto|dolo de segundo grau|dolo alternativo/i, A.dolo],
  [/culpa consciente|culpa inconsciente|imprud[êe]ncia|neglig[êe]ncia|imper[íi]cia/i, A.culpa],
  [/consuma[çc][ãa]o|consumad/i, A.consumacao],
  [/tentativa|tentad/i, A.tentativa],
  [/nexo causal|rela[çc][ãa]o de causalidade|causa superveniente/i, A.causalidade],
];

/** Artigos citados no texto ("art. 14, II do CP"), para flashcards e questões sem artigos_questao. */
function artigosNoTexto(texto: string) {
  return [...texto.matchAll(/\bart(?:igo)?s?\.?\s*(\d{1,3}(?:-[a-z])?)\b(?!\s*,?\s*(?:§[^,;]*,?\s*)?(?:d[aoe]s?\s+)?(?:cpp|cf\b|ctb|constitui|lei\b|lep\b|eca\b))/gi)].map((m) =>
    m[1]!.toUpperCase(),
  );
}

/** Artigo do "Fundamento legal:" do comentário ou da lei_referencia: o que sustenta o gabarito. */
function artigoPrincipal(comentario: string, lei: string) {
  const f = /fundamento legal:?\s*([^\n]+)/i.exec(comentario)?.[1] ?? "";
  return artigosNoTexto(`${lei} ${f}`)[0] ?? null;
}

type Item = { tabela: "questoes" | "flashcards"; id: number; de: string; texto: string; comentario: string; lei: string; artigos: string[] };

const TEORIA = "Teoria do Crime e Fato Típico";
/** Decididas lendo o enunciado (a regra automática não chegava a uma área só). Chave: "q<id>" ou "f<id>". */
const DECIDIDAS: Record<string, Destino | typeof TEORIA> = {
  q15089: A.culpa, // motorista distraído: não quis nem assumiu o risco
  q14062: A.putativas, // irmão gêmeo: supôs situação de fato que tornaria a ação legítima (art. 20, § 1º)
  q14060: A.excludentes, // excesso culposo (art. 23, parágrafo único)
  q14064: A.excludentes, // excesso na legítima defesa
  q14079: A.excludentes, // excesso no estado de necessidade
  q14072: A.obediencia, // ordem manifestamente ilegal
  q14070: A.erroTipo, // desobediência sem saber que era funcionário
  q14075: A.erroTipo, // erro sobre a pessoa (art. 20, § 3º)
  q14074: A.erroProibicao,
  q14313: A.erroProibicao,
  q14317: A.putativas,
  q9248: A.embriaguez, // embriaguez forçada
  q9238: A.embriaguez, // dependência química
  f2262: A.embriaguez, // art. 45 da Lei de Drogas
  q14311: TEORIA, // teoria da culpabilidade (estrutura do crime)
  q14310: TEORIA,
  q9231: TEORIA,
  q4476: TEORIA,
  q9233: TEORIA,
};

function classificar(it: Item): { para: Destino | typeof TEORIA | null; motivo: string } {
  const decidida = DECIDIDAS[`${it.tabela === "questoes" ? "q" : "f"}${it.id}`];
  if (decidida) return { para: decidida, motivo: "decidida lendo o enunciado" };
  const texto = `${it.texto}\n${it.comentario}\n${it.lei}`;
  const resolver = (a: string) => {
    const r = areaDoArtigo(a);
    if (r === "14" || r === "18" || r === "20" || r === "22") return desempatar(r, texto);
    return r;
  };
  // 1. O artigo do fundamento legal.
  const principal = artigoPrincipal(it.comentario, it.lei);
  if (principal) {
    const r = resolver(principal);
    if (r) return { para: r, motivo: `fundamento: art. ${principal}` };
  }
  // 2. Os artigos ligados à questão: se todos levam à mesma área.
  const areas = [...new Set(it.artigos.map(resolver).filter((x): x is Destino => !!x))];
  if (areas.length === 1) return { para: areas[0]!, motivo: `artigos: ${it.artigos.join(", ")}` };
  if (areas.length > 1) {
    // Mais de uma: a mais frequente nos artigos.
    const freq = new Map<Destino, number>();
    for (const a of it.artigos) {
      const r = resolver(a);
      if (r) freq.set(r, (freq.get(r) ?? 0) + 1);
    }
    const [primeiro, segundo] = [...freq.entries()].sort((x, y) => y[1] - x[1]);
    if (primeiro && (!segundo || primeiro[1] > segundo[1])) return { para: primeiro[0], motivo: `artigos (maioria): ${it.artigos.join(", ")}` };
  }
  // 3. Palavras que só aparecem num tema.
  for (const [re, area] of POR_PALAVRAS) if (re.test(it.texto)) return { para: area, motivo: `palavras: ${re.source.slice(0, 30)}` };
  return { para: null, motivo: `indefinido (artigos: ${it.artigos.join(", ") || "nenhum"})` };
}

// --------------------------------------------------------------------------------------------

const disciplinaId = Number((await prod.execute("select id from disciplinas where nome = 'Direito Penal'")).rows[0]!.id);
const areasBanco = new Map(
  (await prod.execute({ sql: "select id, nome from assuntos where disciplina_id = ?", args: [disciplinaId] })).rows.map((l) => [String(l.nome), Number(l.id)]),
);
const fontes = FONTES.filter((f) => areasBanco.has(f));

const itens: Item[] = [];
for (const fonte of fontes) {
  const id = areasBanco.get(fonte)!;
  const qs = await prod.execute({ sql: "select id, enunciado, alternativas, gabarito, comentario, lei_referencia from questoes where assunto_id = ?", args: [id] });
  for (const l of qs.rows) {
    const alts = JSON.parse(String(l.alternativas)) as { letra: string; texto: string }[];
    const certa = alts.find((a) => a.letra === l.gabarito)?.texto ?? "";
    const artigos = (await prod.execute({ sql: "select artigo from artigos_questao where questao_id = ? and lei = 'cp'", args: [Number(l.id)] })).rows.map((x) =>
      String(x.artigo),
    );
    itens.push({ tabela: "questoes", id: Number(l.id), de: fonte, texto: `${l.enunciado}\n${certa}`, comentario: String(l.comentario ?? ""), lei: String(l.lei_referencia ?? ""), artigos });
  }
  const fs = await prod.execute({ sql: "select id, frente, verso, lei_referencia from flashcards where assunto_id = ?", args: [id] });
  for (const l of fs.rows) {
    const texto = `${l.frente}\n${l.verso}`;
    itens.push({ tabela: "flashcards", id: Number(l.id), de: fonte, texto, comentario: "", lei: String(l.lei_referencia ?? ""), artigos: artigosNoTexto(`${texto} ${l.lei_referencia ?? ""}`) });
  }
}

const resultado = itens.map((it) => ({ ...it, ...classificar(it) }));
const resumo: Record<string, Record<string, number>> = {};
for (const r of resultado) {
  const de = (resumo[r.de] ??= {});
  const chave = `${r.para ?? "INDEFINIDO"} (${r.tabela === "questoes" ? "q" : "f"})`;
  de[chave] = (de[chave] ?? 0) + 1;
}
const indefinidos = resultado.filter((r) => !r.para);
mkdirSync("data/publicacao", { recursive: true });
writeFileSync(
  "data/publicacao/parte-geral-penal.json",
  JSON.stringify(
    { resumo, indefinidos: indefinidos.map((r) => ({ tabela: r.tabela, id: r.id, de: r.de, motivo: r.motivo, texto: r.texto.slice(0, 300) })), todos: resultado.map((r) => ({ tabela: r.tabela, id: r.id, de: r.de, para: r.para, motivo: r.motivo })) },
    null,
    2,
  ),
);
for (const [de, paras] of Object.entries(resumo)) {
  console.log(`\n${de}`);
  for (const [para, qtd] of Object.entries(paras).sort((x, y) => y[1] - x[1])) console.log(`   ${String(qtd).padStart(4)}  -> ${para}`);
}
console.log(`\nTotal: ${resultado.length} itens. Indefinidos (ficam onde estão): ${indefinidos.length}. Detalhes em data/publicacao/parte-geral-penal.json`);

if (!APLICAR) {
  console.log("Nada gravado. Confira e rode com --aplicar (depois do backup).");
  process.exit(0);
}

for (const nome of new Set(resultado.flatMap((r) => (r.para ? [r.para] : [])))) {
  if (!areasBanco.has(nome)) {
    await prod.execute({ sql: "insert into assuntos (disciplina_id, nome) values (?, ?) on conflict do nothing", args: [disciplinaId, nome] });
  }
}
const ids = new Map(
  (await prod.execute({ sql: "select id, nome from assuntos where disciplina_id = ?", args: [disciplinaId] })).rows.map((l) => [String(l.nome), Number(l.id)]),
);
let movidos = 0;
for (const tabela of ["questoes", "flashcards"] as const) {
  const grupos = new Map<string, number[]>();
  for (const r of resultado) if (r.tabela === tabela && r.para && r.para !== r.de) (grupos.get(r.para) ?? grupos.set(r.para, []).get(r.para)!).push(r.id);
  for (const [para, lista] of grupos) {
    for (let i = 0; i < lista.length; i += 200) {
      const parte = lista.slice(i, i + 200);
      await prod.execute({ sql: `update ${tabela} set assunto_id = ? where id in (${parte.map(() => "?").join(",")})`, args: [ids.get(para)!, ...parte] });
      movidos += parte.length;
    }
  }
}
await recontar(drizzle(prod, { schema }) as unknown as Db);
console.log(`Movidos: ${movidos}. Contagens recalculadas.`);
