// Questões de IA publicadas que giram em torno de quantidade de pena: tira do ar, reescreve
// (cobrando o crime) e devolve ao ar a MESMA questão (mesmo id: o histórico dos alunos fica).
//
//   npx tsx scripts/publicacao/pena.ts listar                 mostra quais saem e quais ficam (só leitura)
//   npx tsx scripts/publicacao/pena.ts suspender --aplicar    tira do ar na produção e recalcula contagens
//   npx tsx scripts/publicacao/pena.ts preparar               cria data/publicacao/pena/entrada-N.json (+ leis por tópico)
//   npx tsx scripts/publicacao/pena.ts conferir <N>           confere reescrita-N.json (para o subagente)
//   npx tsx scripts/publicacao/pena.ts conferir-auditoria <N> confere auditoria-N.json (para o auditor)
//   npx tsx scripts/publicacao/pena.ts aplicar --aplicar      grava na produção e no local.db as aprovadas e devolve ao ar
import "../_env";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { z } from "zod";
import type { Db } from "../../src/db";
import * as schema from "../../src/db/schema";
import { montarComentario } from "../../src/lib/revisao";
import { acharTopico, lerTaxonomia, textoLegal } from "../questoes/contexto";
import { cobraPena } from "../questoes/esquema";
import { recontar } from "../lib/recontar";

// --importadas: questões importadas pelo /admin (sem origem), corrigidas no lugar, sem sair do ar.
const IMPORTADAS = process.argv.includes("--importadas");
const PASTA = IMPORTADAS ? "data/publicacao/pena-importadas" : "data/publicacao/pena";
const POR_ARQUIVO = 8;
const MANTER = 4; // questões de pena que continuam no ar (a exceção que a regra permite)
const APLICAR = process.argv.includes("--aplicar");

const url = process.env.TURSO_DATABASE_URL ?? "";
if (!url.startsWith("libsql://")) throw new Error("TURSO_DATABASE_URL não é um banco Turso");

// O Turso às vezes derruba a primeira conexão de um processo longo: repete só erro de rede.
function clienteComNovaTentativa(): Client {
  const c = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const queda = (e: unknown) => /fetch failed|other side closed|UND_ERR_SOCKET|ECONNRESET/i.test(`${(e as Error).message} ${JSON.stringify((e as { cause?: unknown }).cause ?? "")}`);
  const repetir =
    <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    async (...a: A): Promise<R> => {
      for (let t = 1; ; t++) {
        try {
          return await fn(...a);
        } catch (e) {
          if (t >= 4 || !queda(e)) throw e;
          await new Promise((r) => setTimeout(r, 2000 * t));
        }
      }
    };
  c.execute = repetir(c.execute.bind(c)) as typeof c.execute;
  c.batch = repetir(c.batch.bind(c)) as typeof c.batch;
  return c;
}
const prod = clienteComNovaTentativa();

type Linha = { id: number; codigo: string; disciplina: string; enunciado: string; alternativas: { letra: string; texto: string }[]; gabarito: string; suspensa: number; topico: string | null; assunto: string | null; comentario: string | null };

async function candidatas() {
  const r = await prod.execute(
    `select q.id, q.codigo, d.nome disciplina, a.nome assunto, q.enunciado, q.alternativas, q.gabarito, q.comentario, q.suspensa, q.topico_taxonomia topico from questoes q join disciplinas d on d.id = q.disciplina_id left join assuntos a on a.id = q.assunto_id where ${IMPORTADAS ? "q.origem is null and q.suspensa = 0" : "q.origem = 'ia'"} order by q.id`,
  );
  const todas: Linha[] = r.rows.map((x) => ({
    id: Number(x.id),
    codigo: String(x.codigo),
    disciplina: String(x.disciplina),
    enunciado: String(x.enunciado),
    alternativas: JSON.parse(String(x.alternativas)),
    gabarito: String(x.gabarito),
    suspensa: Number(x.suspensa),
    topico: x.topico ? String(x.topico) : null,
    assunto: x.assunto ? String(x.assunto) : null,
    comentario: x.comentario ? String(x.comentario) : null,
  }));
  // Só matérias penais: em Constitucional, "dois terços" e "metade" costumam ser quórum, não pena.
  // Assuntos em que a pena é o próprio conteúdo (penas, prescrição) não entram.
  const pena = todas.filter((q) => /Penal/.test(q.disciplina) && !/Processual/.test(q.disciplina) && !/pena|prescri/i.test(q.assunto ?? "") && cobraPena(q));
  // Ficam no ar até 10% das questões penais como a exceção permitida (importadas) ou MANTER (geradas aqui).
  const penais = todas.filter((q) => /Penal/.test(q.disciplina) && !/Processual/.test(q.disciplina)).length;
  const manter = IMPORTADAS ? Math.floor(penais * 0.1) : MANTER;
  // Ficam no ar as que perguntam a pena de propósito (enunciado fala em pena), uma por tópico, até MANTER.
  const ficam: Linha[] = [];
  for (const q of pena.filter((x) => /\bpena\b|san[çc][ãa]o/i.test(x.enunciado))) {
    if (ficam.length >= manter) break;
    const chave = q.topico ?? q.assunto;
    if (IMPORTADAS ? ficam.filter((f) => (f.topico ?? f.assunto) === chave).length < 3 : !ficam.some((f) => f.topico === q.topico)) ficam.push(q);
  }
  const saem = pena.filter((q) => !ficam.includes(q));
  return { pena, ficam, saem };
}

async function listar() {
  const { pena, ficam, saem } = await candidatas();
  console.log(`${pena.length} questões de IA giram em torno de pena; ficam no ar ${ficam.length}; saem para reescrita ${saem.length}.`);
  const porDisc = new Map<string, number>();
  for (const q of saem) porDisc.set(q.disciplina, (porDisc.get(q.disciplina) ?? 0) + 1);
  console.log("Saem:", Object.fromEntries(porDisc));
  console.log("Ficam:", ficam.map((q) => `${q.id} ${q.enunciado.slice(0, 70)}`));
  return saem;
}

async function suspender() {
  const saem = await listar();
  mkdirSync(PASTA, { recursive: true });
  writeFileSync(`${PASTA}/suspensas.json`, JSON.stringify(saem.map((q) => ({ id: q.id, codigo: q.codigo })), null, 2));
  if (!APLICAR) return console.log("Prévia: nada foi alterado. Use --aplicar.");
  const ids = saem.map((q) => q.id);
  await prod.execute({ sql: `update questoes set suspensa = 1 where id in (${ids.map(() => "?").join(",")})`, args: ids });
  await prod.execute({
    sql: `update questoes_revisao set status = 'pendente_revisao', motivo_revisao = 'Fora do ar para reescrita: cobrava quantidade de pena' where codigo in (${ids.map(() => "?").join(",")})`,
    args: saem.map((q) => q.codigo),
  });
  await recontar(drizzle(prod, { schema }) as unknown as Db);
  console.log(`${ids.length} questões fora do ar na produção; contagens recalculadas. Lista em ${PASTA}/suspensas.json`);
}

async function preparar() {
  const suspensas = JSON.parse(readFileSync(`${PASTA}/suspensas.json`, "utf8")) as { id: number; codigo: string }[];
  const codigos = suspensas.map((s) => s.codigo);
  const r = await prod.execute({
    sql: `select q.id, q.alternativas, q.gabarito, q.enunciado, r.* from questoes q left join questoes_revisao r on r.codigo = q.codigo where q.codigo in (${codigos.map(() => "?").join(",")}) order by q.id`,
    args: codigos,
  });
  const tax = lerTaxonomia();
  mkdirSync(`${PASTA}/leis`, { recursive: true });
  const itens = r.rows.map((x) => {
    const topico = String(x.topico_taxonomia);
    const arqLei = `${PASTA}/leis/${topico}.md`;
    if (!existsSync(arqLei)) {
      const { disciplina, topico: t } = acharTopico(tax, topico);
      writeFileSync(arqLei, `# ${disciplina} > ${t.nome}\n\n${textoLegal(tax, t) || "Sem texto legal para este tópico."}\n`);
    }
    return {
      id: Number(x[0] ?? x.id),
      banca: x.banca,
      disciplina: x.disciplina,
      assunto: x.assunto,
      subtopico: x.subtopico,
      lei: arqLei,
      atual: {
        enunciado: String(x.enunciado),
        alternativas: JSON.parse(String(x.alternativas)),
        gabarito: String(x.gabarito),
        comentario: x.comentario,
        analise_alternativas: x.analise_alternativas ? JSON.parse(String(x.analise_alternativas)) : [],
        fundamento_legal: x.fundamento_legal,
        pegadinha: x.pegadinha,
      },
    };
  });
  for (let i = 0; i * POR_ARQUIVO < itens.length; i++) writeFileSync(`${PASTA}/entrada-${i + 1}.json`, JSON.stringify({ itens: itens.slice(i * POR_ARQUIVO, (i + 1) * POR_ARQUIVO) }, null, 2));
  console.log(`${itens.length} questões em ${Math.ceil(itens.length / POR_ARQUIVO)} arquivos (${PASTA}/entrada-N.json)`);
}

/** Importadas: não saem do ar; a lei de cada uma vem do tópico da taxonomia mais parecido com o assunto. */
async function prepararImportadas() {
  const { saem } = await candidatas();
  const tax = lerTaxonomia();
  mkdirSync(`${PASTA}/leis`, { recursive: true });
  const { semelhanca } = await import("../../src/lib/catalogo");
  const semLei: string[] = [];
  const itens = saem.map((q) => {
    const disc = tax.disciplinas.find((d) => d.nome === q.disciplina);
    const melhor = (disc?.topicos ?? [])
      .map((t) => ({ t, n: semelhanca(q.assunto ?? "", t.nome) }))
      .sort((a, b) => b.n - a.n)[0];
    let arqLei: string | null = null;
    if (melhor && melhor.n >= 0.35) {
      arqLei = `${PASTA}/leis/${melhor.t.id}.md`;
      if (!existsSync(arqLei)) writeFileSync(arqLei, `# ${q.disciplina} > ${melhor.t.nome}

${textoLegal(tax, melhor.t) || "Sem texto legal para este tópico."}
`);
    } else semLei.push(`${q.id} (${q.assunto})`);
    return {
      id: q.id,
      disciplina: q.disciplina,
      assunto: q.assunto,
      lei: arqLei ?? "sem arquivo de lei: use a lei vigente que o enunciado e o comentário citam",
      atual: { enunciado: q.enunciado, alternativas: q.alternativas, gabarito: q.gabarito, comentario: q.comentario, analise_alternativas: [], fundamento_legal: null, pegadinha: null },
    };
  });
  for (let i = 0; i * POR_ARQUIVO < itens.length; i++) writeFileSync(`${PASTA}/entrada-${i + 1}.json`, JSON.stringify({ itens: itens.slice(i * POR_ARQUIVO, (i + 1) * POR_ARQUIVO) }, null, 2));
  console.log(`${itens.length} questões em ${Math.ceil(itens.length / POR_ARQUIVO)} arquivos (${PASTA}/entrada-N.json); ${semLei.length} sem lei encontrada${semLei.length ? ": " + semLei.slice(0, 15).join("; ") : ""}`);
}

// ---------- reescrita e auditoria ----------

const texto = z.string().trim().min(1);
const esquemaReescrita = z.object({
  itens: z.array(
    z.object({
      id: z.number(),
      enunciado: texto,
      alternativas: z.array(z.object({ letra: z.string().regex(/^[A-E]$/), texto })),
      gabarito: z.string().regex(/^[A-E]$/),
      comentario: texto,
      analise_alternativas: z.array(z.object({ letra: z.string(), correta: z.boolean(), justificativa: texto })),
      fundamento_legal: z.string().nullable(),
      pegadinha: z.string().nullable(),
      o_que_mudou: texto,
    }),
  ),
});
const esquemaAuditoria = z.object({
  auditorias: z.array(
    z.object({ id: z.number(), status: z.enum(["VALIDADA", "VALIDADA_COM_RESSALVA", "NECESSITA_DE_CONFERENCIA", "REPROVADA"]), justificativa: texto, correcao_sugerida: z.string().nullable() }),
  ),
});

function validarReescrita(n: string) {
  const entrada = JSON.parse(readFileSync(`${PASTA}/entrada-${n}.json`, "utf8")).itens as { id: number; atual: { alternativas: { letra: string }[] } }[];
  const arquivo = `${PASTA}/reescrita-${n}.json`;
  if (!existsSync(arquivo)) return { erros: [`${arquivo} não existe`] };
  const r = esquemaReescrita.safeParse(JSON.parse(readFileSync(arquivo, "utf8")));
  if (!r.success) return { erros: r.error.issues.slice(0, 12).map((i) => `${i.path.join(".")}: ${i.message}`) };
  const erros: string[] = [];
  for (const e of entrada) {
    const s = r.data.itens.find((x) => x.id === e.id);
    if (!s) {
      erros.push(`falta a questão ${e.id}`);
      continue;
    }
    const letras = (x: { letra: string }[]) => x.map((a) => a.letra).join("");
    if (letras(s.alternativas) !== letras(e.atual.alternativas)) erros.push(`${e.id}: mantenha as mesmas letras (${letras(e.atual.alternativas)})`);
    if (!s.alternativas.some((a) => a.letra === s.gabarito)) erros.push(`${e.id}: gabarito não é uma das alternativas`);
    if (letras(s.analise_alternativas) !== letras(s.alternativas)) erros.push(`${e.id}: a análise precisa de uma entrada por letra, na ordem`);
    const corretas = s.analise_alternativas.filter((a) => a.correta).map((a) => a.letra);
    if (corretas.length !== 1 || corretas[0] !== s.gabarito) erros.push(`${e.id}: a análise deve marcar só o gabarito como correto`);
    if (cobraPena(s)) erros.push(`${e.id}: as alternativas ainda giram em torno de quantidade de pena`);
    const c = s.alternativas.find((a) => a.letra === s.gabarito)?.texto.length ?? 0;
    const outras = s.alternativas.filter((a) => a.letra !== s.gabarito).map((a) => a.texto.length);
    const razao = c / (outras.reduce((x, y) => x + y, 0) / outras.length);
    if (razao > 1.25 || razao < 0.8) erros.push(`${e.id}: a correta tem ${Math.round(razao * 100)}% da média das erradas (limite 80% a 125%)`);
  }
  return { erros, dados: r.data };
}

function validarAuditoria(n: string) {
  const ids = (JSON.parse(readFileSync(`${PASTA}/entrada-${n}.json`, "utf8")).itens as { id: number }[]).map((x) => x.id);
  const arquivo = `${PASTA}/auditoria-${n}.json`;
  if (!existsSync(arquivo)) return { erros: [`${arquivo} não existe`] };
  const r = esquemaAuditoria.safeParse(JSON.parse(readFileSync(arquivo, "utf8")));
  if (!r.success) return { erros: r.error.issues.slice(0, 12).map((i) => `${i.path.join(".")}: ${i.message}`) };
  const faltam = ids.filter((id) => !r.data.auditorias.some((a) => a.id === id));
  return { erros: faltam.length ? [`sem auditoria para ${faltam.join(", ")}`] : [], dados: r.data };
}

async function aplicar() {
  const local = createClient({ url: "file:local.db" });
  const resumo = { voltaram: 0, ficaramFora: [] as string[] };
  for (const f of readdirSync(PASTA).filter((x) => /^entrada-\d+\.json$/.test(x))) {
    const n = f.match(/\d+/)![0];
    const re = validarReescrita(n);
    const au = validarAuditoria(n);
    if (re.erros.length || au.erros.length || !re.dados || !au.dados) {
      console.log(`lote ${n} com erros, nada aplicado:\n  ${[...re.erros, ...au.erros].join("\n  ")}`);
      process.exitCode = 1;
      continue;
    }
    for (const s of re.dados.itens) {
      const a = au.dados.auditorias.find((x) => x.id === s.id)!;
      if (a.status !== "VALIDADA") {
        resumo.ficaramFora.push(`${s.id} (${a.status}): ${a.justificativa}`);
        continue;
      }
      const comentario = montarComentario({
        comentario: s.comentario,
        analiseAlternativas: s.analise_alternativas,
        fundamentoLegal: s.fundamento_legal,
        fundamentoJurisprudencial: null,
        observacaoTemporal: null,
        pegadinha: s.pegadinha,
        destaques: null,
      });
      if (!APLICAR) {
        resumo.voltaram++;
        continue;
      }
      const [q] = (await prod.execute({ sql: "select codigo from questoes where id = ?", args: [s.id] })).rows;
      const codigo = String(q!.codigo);
      // Mesma questão (mesmo id e código), conteúdo novo e de volta ao ar.
      await prod.execute({
        sql: "update questoes set enunciado = ?, alternativas = ?, gabarito = ?, comentario = ?, suspensa = 0 where id = ?",
        args: [s.enunciado, JSON.stringify(s.alternativas), s.gabarito, comentario, s.id],
      });
      const camposRevisao = {
        sql: "update questoes_revisao set enunciado = ?, alternativas = ?, gabarito = ?, comentario = ?, analise_alternativas = ?, fundamento_legal = ?, pegadinha = ?, destaques = null, comentario_final = ?, status = 'aprovada', motivo_revisao = ? where codigo = ?",
        args: [s.enunciado, JSON.stringify(s.alternativas), s.gabarito, s.comentario, JSON.stringify(s.analise_alternativas), s.fundamento_legal, s.pegadinha, comentario, `Reescrita sem foco em pena: ${s.o_que_mudou}`.slice(0, 1900), codigo],
      };
      await prod.execute(camposRevisao);
      await local.execute(camposRevisao);
      await local.execute({ sql: "update questoes set enunciado = ?, alternativas = ?, gabarito = ?, comentario = ? where codigo = ?", args: [s.enunciado, JSON.stringify(s.alternativas), s.gabarito, comentario, codigo] });
      resumo.voltaram++;
    }
  }
  if (APLICAR) await recontar(drizzle(prod, { schema }) as unknown as Db);
  console.log(`${APLICAR ? "Aplicado" : "Prévia"}: ${resumo.voltaram} voltam ao ar reescritas; ${resumo.ficaramFora.length} continuam fora.`);
  for (const x of resumo.ficaramFora) console.log(`  fora: ${x}`);
}

const [comando, arg] = process.argv.slice(2);
if (comando === "listar") await listar();
else if (comando === "suspender") await suspender();
else if (comando === "preparar") await (IMPORTADAS ? prepararImportadas() : preparar());
else if (comando === "conferir" && arg) {
  const { erros } = validarReescrita(arg);
  console.log(erros.length ? `INVALIDO:\n  ${erros.join("\n  ")}` : "OK");
} else if (comando === "conferir-auditoria" && arg) {
  const { erros } = validarAuditoria(arg);
  console.log(erros.length ? `INVALIDO:\n  ${erros.join("\n  ")}` : "OK");
} else if (comando === "aplicar") await aplicar();
else console.log("Comandos: listar | suspender [--aplicar] | preparar | conferir <N> | conferir-auditoria <N> | aplicar [--aplicar]");
