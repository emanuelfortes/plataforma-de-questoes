// Filtro de segurança antes de publicar na produção. Só lê o local.db e as leis; não altera nada.
// Para cada questão e flashcard das filas de revisão, diz se pode subir e, se não, por quê.
//
//   npx tsx scripts/publicacao/filtro.ts          resumo + data/publicacao/filtro.json
//
// Retém (não sobe):
//  - cobra artigo marcado na lei com "(Vide ADI", "(Vide Adin", "(Vide ADC" ou "(Vide ADPF" sem nota sobre o STF;
//  - cobra dispositivo de data/dispositivos-sensiveis.json sem a nota, ou usa trecho "[CONFIRMAR]";
//  - cita julgado fora de data/jurisprudencia.json;
//  - tamanho da correta fora de 80% a 125% da média das erradas;
//  - texto de exemplo ("(Exemplo N)"); auditor REPROVADA; rejeitada na revisão.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { acharTopico, leisDoTopico, lerJurisprudencia, lerTaxonomia, sensiveisDoTopico } from "../questoes/contexto";
import {
  citacoesForaDaLista,
  dispositivosSemNota,
  LIMITE_TAMANHO,
  LIMITE_TAMANHO_MINIMO,
  tamanhoDaCorreta,
  trechosAConfirmar,
  type QuestaoGerada,
} from "../questoes/esquema";

const NOTA_STF = /\bSTF\b|Supremo|inconstitucion|interpreta[çc][ãa]o conforme|n[ãa]o (foi )?recepcionad|n[ãa]o recep[çc][ãa]o|\bADI\b|\bADC\b|\bADPF\b/i;
const VIDE = /\((?:Vide|Vide\s+a)\s+(ADI|ADIN|Adin|ADC|ADPF)\b[^)]*\)|declarad[oa]s? inconstitucional/i;

// ---------- marcas "(Vide ADI...)" nas leis, por artigo e por inciso/parágrafo ----------

type Marcas = { caput: boolean; unidades: Set<string>; trechos: string[]; palavras: Set<string>[] };

// Palavras que identificam o conteúdo do trecho marcado (para citação do artigo sem inciso/parágrafo).
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const COMUNS = new Set(
  "previsto prevista artigo redacao incluido incluida emenda constitucional paragrafo disposto termos conforme seguinte respectivo respectiva qualquer poderao deverao mediante nacional federal estados municipios quando estiver estabelecido estabelecida regulamento hipotese hipoteses observado observada declarado declarada".split(" "),
);
function palavrasDistintivas(trecho: string) {
  const limpo = semAcento(trecho.replace(/\([^)]*\)/g, " "));
  return new Set((limpo.match(/[a-z]{7,}/g) ?? []).filter((p) => !COMUNS.has(p)));
}
/** O texto trata do conteúdo do trecho marcado? (2 palavras distintivas, ou 1 se o trecho tiver até 3) */
const trataDoTrecho = (textoNormalizado: string, palavras: Set<string>) => {
  const achadas = [...palavras].filter((p) => textoNormalizado.includes(p)).length;
  return achadas >= 2 || (achadas >= 1 && palavras.size <= 3);
};
const ROMANO = /^([IVXLC]+)\s*[-–]/;
const PARAGRAFO = /^(§\s*(\d+)\s*[º°o]?|Par[áa]grafo [úu]nico)/i;

function marcasDaLei(id: string) {
  const mapa = new Map<string, Marcas>();
  // Frequência das palavras na lei inteira: só as raras (até 3 vezes) identificam um trecho.
  const freq = new Map<string, number>();
  for (const p of semAcento(readFileSync(`data/leis/${id}.txt`, "utf8")).match(/[a-z]{7,}/g) ?? []) freq.set(p, (freq.get(p) ?? 0) + 1);
  const raras = (trecho: string) => new Set([...palavrasDistintivas(trecho)].filter((p) => (freq.get(p) ?? 0) <= 3));
  let art: string | null = null;
  let paragrafo: string | null = null;
  let inciso: string | null = null;
  for (const linha of readFileSync(`data/leis/${id}.txt`, "utf8").split("\n")) {
    const l = linha.trim();
    // "Art. 3º-A." tem sufixo; "Art. 23 - Não há crime" não (o hífen com espaço é pontuação).
    const a = /^Art\.?\s*(\d+)\s*[º°o]?(?:-([A-Z]))?(?=[\s.])/.exec(l);
    let unidade: string | null = null;
    if (a) {
      art = a[1] + (a[2] ? `-${a[2]}` : "");
      paragrafo = inciso = null;
    } else if (PARAGRAFO.test(l)) {
      const p = PARAGRAFO.exec(l)!;
      paragrafo = p[2] ? `p${p[2]}` : "pu";
      inciso = null;
      unidade = paragrafo;
    } else if (ROMANO.test(l)) {
      inciso = ROMANO.exec(l)![1]!;
      unidade = inciso;
    } else unidade = inciso ?? paragrafo;
    if (!art || !VIDE.test(l)) continue;
    const m = mapa.get(art) ?? { caput: false, unidades: new Set<string>(), trechos: [], palavras: [] };
    if (a) m.caput = true;
    else if (unidade) m.unidades.add(unidade);
    m.trechos.push(l.slice(0, 160));
    m.palavras.push(raras(l));
    mapa.set(art, m);
  }
  return mapa;
}

const cacheMarcas = new Map<string, Map<string, Marcas>>();
const leisComTexto = new Set(readdirSync("data/leis").map((f) => f.replace(/\.txt$/, "")));
function marcas(lei: string) {
  if (!leisComTexto.has(lei)) return new Map<string, Marcas>();
  if (!cacheMarcas.has(lei)) cacheMarcas.set(lei, marcasDaLei(lei));
  return cacheMarcas.get(lei)!;
}

/** Citações "art. N[, inciso/§]" no texto. */
function citacoes(texto: string) {
  const achadas: { art: string; unidade: string | null }[] = [];
  const re = /\bart(?:igo)?s?\.?\s*(\d+)\s*[º°o]?(?:\s*-\s*([A-Z])\b)?([^.;:\n]{0,50})/gi;
  for (const m of texto.matchAll(re)) {
    const resto = m[3] ?? "";
    const p = /§\s*(\d+)|par[áa]grafo [úu]nico/i.exec(resto);
    const r = /^\s*,?\s*(?:inciso\s+)?([IVXL]+)\b/.exec(resto);
    achadas.push({ art: m[1] + (m[2] ? `-${m[2].toUpperCase()}` : ""), unidade: p ? (p[1] ? `p${p[1]}` : "pu") : r ? r[1]! : null });
  }
  return achadas;
}

/**
 * Dispositivos marcados com "Vide ADI" que o texto cobra. Unidade citada (inciso/§): conta se a unidade
 * ou o caput for marcado. Artigo citado sem unidade: conta se o caput for marcado ou se o texto tratar
 * do conteúdo de algum trecho marcado (ex.: "inafiançável" no art. 14 do Estatuto do Desarmamento).
 */
function videAdiCitados(texto: string, leis: string[]) {
  const achados = new Set<string>();
  const normalizado = semAcento(texto);
  for (const c of citacoes(texto))
    for (const lei of leis) {
      const m = marcas(lei).get(c.art);
      if (!m) continue;
      const conta = c.unidade ? m.caput || m.unidades.has(c.unidade) : m.caput || m.palavras.some((p) => trataDoTrecho(normalizado, p));
      if (conta) achados.add(`${lei} art. ${c.art}${c.unidade ? ` (${c.unidade})` : ""}`);
    }
  return [...achados];
}

// ---------- avaliação ----------

export type Avaliacao = { tipo: "questao" | "flashcard"; id: number; lote: string; status: string; sobe: boolean; motivos: string[] };

export async function avaliar(url = "file:local.db"): Promise<Avaliacao[]> {
  const db = createClient({ url });
  const tax = lerTaxonomia();
  const julgados = lerJurisprudencia();
  const saida: Avaliacao[] = [];
  const contexto = new Map<string, { leis: string[]; sensiveis: ReturnType<typeof sensiveisDoTopico> }>();
  const ctx = (topico: string) => {
    if (!contexto.has(topico)) {
      const t = acharTopico(tax, topico).topico;
      contexto.set(topico, { leis: leisDoTopico(t), sensiveis: sensiveisDoTopico(t) });
    }
    return contexto.get(topico)!;
  };

  const qs = await db.execute("select * from questoes_revisao order by id");
  for (const r of qs.rows) {
    const alternativas = JSON.parse(String(r.alternativas)) as { letra: string; texto: string }[];
    const analise = JSON.parse(String(r.analise_alternativas)) as { letra: string; justificativa: string }[];
    const destaques = (r.destaques ? JSON.parse(String(r.destaques)) : []) as { texto: string }[];
    const auditoria = JSON.parse(String(r.auditoria));
    // Adaptador para as checagens do gerador (que esperam o formato com ids).
    const q = {
      id: String(r.lote),
      enunciado: String(r.enunciado),
      alternativas: alternativas.map((a) => ({ id: a.letra, texto: a.texto })),
      id_correta: String(r.gabarito),
      comentario_geral: String(r.comentario),
      analise_alternativas: analise.map((a) => ({ id: a.letra, correta: a.letra === r.gabarito, justificativa: a.justificativa })),
      fundamento_legal: String(r.fundamento_legal ?? ""),
      fundamento_jurisprudencial: String(r.fundamento_jurisprudencial ?? ""),
      observacao_temporal: String(r.observacao_temporal ?? ""),
      pegadinha: String(r.pegadinha ?? ""),
      lei_referencia: String(r.lei_referencia ?? ""),
      macete_do_riccardo: destaques.map((d) => d.texto).join(" ") || null,
      fique_ligado: null,
      cuidado_na_prova: null,
    } as unknown as QuestaoGerada;
    const { leis, sensiveis } = ctx(String(r.topico_taxonomia));
    const textoCobrado = [q.enunciado, ...alternativas.map((a) => a.texto), q.fundamento_legal, q.lei_referencia, ...analise.map((a) => a.justificativa)].join("\n");
    const notas = [q.comentario_geral, q.fundamento_jurisprudencial, q.observacao_temporal, ...destaques.map((d) => d.texto)].join("\n");
    const motivos: string[] = [];
    if (r.status === "rejeitada") motivos.push("rejeitada na revisão");
    if ([auditoria.status, auditoria.segundo?.status].includes("REPROVADA")) motivos.push("reprovada por auditor");
    const vide = videAdiCitados(textoCobrado, leis);
    if (vide.length && !NOTA_STF.test(notas)) motivos.push(`cobra dispositivo com "Vide ADI/ADC" sem nota sobre o STF: ${vide.join(", ")}`);
    for (const d of dispositivosSemNota(q, sensiveis)) motivos.push(`dispositivo sensível sem nota: ${d}`);
    for (const t of trechosAConfirmar(q, sensiveis)) motivos.push(`usa trecho a confirmar: ${t}`);
    for (const c of citacoesForaDaLista(q, julgados)) motivos.push(`cita julgado fora da lista: ${c}`);
    const t = tamanhoDaCorreta(q);
    if (t.razao > LIMITE_TAMANHO || t.razao < LIMITE_TAMANHO_MINIMO) motivos.push(`tamanho da correta ${Math.round(t.razao * 100)}% da média das erradas (limite 80% a 125%)`);
    if (/\(Exemplo \d+\)/.test(q.enunciado)) motivos.push("texto de exemplo");
    saida.push({ tipo: "questao", id: Number(r.id), lote: String(r.lote), status: String(r.status), sobe: motivos.length === 0, motivos });
  }

  const fs = await db.execute("select * from flashcards_revisao order by id");
  for (const r of fs.rows) {
    const auditoria = JSON.parse(String(r.auditoria));
    const { leis } = ctx(String(r.topico_taxonomia));
    const texto = `${r.frente}\n${r.verso}\n${r.lei_referencia ?? ""}`;
    const motivos: string[] = [];
    if (r.status === "rejeitada") motivos.push("rejeitado na revisão");
    if ([auditoria.status, auditoria.segundo?.status].includes("REPROVADA")) motivos.push("reprovado por auditor");
    const vide = videAdiCitados(texto, leis);
    if (vide.length && !NOTA_STF.test(String(r.verso))) motivos.push(`cobra dispositivo com "Vide ADI/ADC" sem nota sobre o STF: ${vide.join(", ")}`);
    if (auditoria.citacoes_jurisprudencia?.length) motivos.push(`cita julgado fora da lista: ${auditoria.citacoes_jurisprudencia.join(", ")}`);
    if (/\(Exemplo \d+\)/.test(String(r.frente))) motivos.push("texto de exemplo");
    saida.push({ tipo: "flashcard", id: Number(r.id), lote: String(r.lote), status: String(r.status), sobe: motivos.length === 0, motivos });
  }
  return saida;
}

const direto = /publicacao[\\/]filtro\.ts$/.test(process.argv[1] ?? "");
if (direto) {
  const r = await avaliar();
  mkdirSync("data/publicacao", { recursive: true });
  writeFileSync("data/publicacao/filtro.json", JSON.stringify(r, null, 2));
  for (const tipo of ["questao", "flashcard"] as const) {
    const itens = r.filter((x) => x.tipo === tipo);
    const retidos = itens.filter((x) => !x.sobe);
    const porMotivo = new Map<string, number>();
    for (const x of retidos) for (const m of x.motivos) {
      const chave = m.replace(/:.*$/, "");
      porMotivo.set(chave, (porMotivo.get(chave) ?? 0) + 1);
    }
    console.log(`${tipo}s: ${itens.length} | sobem ${itens.length - retidos.length} | retidos ${retidos.length}`);
    for (const [m, n] of [...porMotivo].sort((a, b) => b[1] - a[1])) console.log(`   ${n}  ${m}`);
  }
}
