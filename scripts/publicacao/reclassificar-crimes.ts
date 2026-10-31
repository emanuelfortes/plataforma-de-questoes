// Divide as questões e flashcards das áreas que viraram pasta em data/ordem-areas.json: os títulos do CP
// ("Crimes contra a Pessoa") nas áreas de cada crime ("Feminicídio") e as leis (Estatuto do Desarmamento,
// Maria da Penha...) nas faixas de artigos do edital. Mesmo id: o histórico dos alunos não muda; só a área.
// O que não dá para decidir com segurança fica na área do título (aparece como "Demais ...").
// A importação já faz isso sozinha para o que entrar daqui em diante (src/db/importacao.ts).
//
//   npx tsx scripts/publicacao/reclassificar-crimes.ts             só lista (grava data/publicacao/reclassificar-crimes.json)
//   npx tsx scripts/publicacao/reclassificar-crimes.ts --aplicar   move e recalcula as contagens
//
// Antes de aplicar: npx tsx scripts/publicacao/backup-producao.ts reclassificar-crimes
import "../_env";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Db } from "../../src/db";
import * as schema from "../../src/db/schema";
import { chaveNome } from "../../src/lib/catalogo";
import { areasBase, classificarArea } from "../../src/lib/ordem-areas";
import { recontar } from "../lib/recontar";

const APLICAR = process.argv.includes("--aplicar");

const url = process.env.TURSO_DATABASE_URL ?? "";
if (!url.startsWith("libsql://")) throw new Error("TURSO_DATABASE_URL não é um banco Turso");
const prod = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

// Matérias que têm alguma área dividida em pastas.
const disciplinas = (await prod.execute("select id, nome from disciplinas")).rows
  .map((l) => ({ id: Number(l.id), nome: String(l.nome) }))
  .filter((d) => areasBase(d.nome).length > 0);

async function areasDoBanco(disciplinaId: number) {
  const r = await prod.execute({ sql: "select id, nome from assuntos where disciplina_id = ?", args: [disciplinaId] });
  return new Map(r.rows.map((l) => [chaveNome(String(l.nome)), Number(l.id)]));
}

type Mudanca = { tabela: "questoes" | "flashcards"; disciplinaId: number; id: number; de: string; para: string; texto: string };
const mudancas: Mudanca[] = [];
const resumo: Record<string, Record<string, number>> = {};

/** Lista o que sai da área `base` (a da pasta) para as áreas de dentro dela. */
async function examinar(disciplinaId: number, materia: string, base: string, baseId: number) {
  const conta = (resumo[`${materia} > ${base}`] ??= {});

  const qs = await prod.execute({
    sql: "select id, enunciado, alternativas, gabarito, comentario, lei_referencia from questoes where assunto_id = ?",
    args: [baseId],
  });
  for (const l of qs.rows) {
    const alts = JSON.parse(String(l.alternativas)) as { letra: string; texto: string }[];
    const para = classificarArea(materia, base, {
      principal: String(l.enunciado),
      correta: alts.find((a) => a.letra === l.gabarito)?.texto,
      resto: [String(l.comentario ?? ""), ...alts.filter((a) => a.letra !== l.gabarito).map((a) => a.texto)].join(" "),
      comentario: l.comentario ? String(l.comentario) : null,
      leiReferencia: l.lei_referencia ? String(l.lei_referencia) : null,
    });
    conta[para ?? "(fica)"] = (conta[para ?? "(fica)"] ?? 0) + 1;
    if (para) mudancas.push({ tabela: "questoes", disciplinaId, id: Number(l.id), de: base, para, texto: String(l.enunciado).slice(0, 160) });
  }

  const fs = await prod.execute({ sql: "select id, frente, verso, lei_referencia from flashcards where assunto_id = ?", args: [baseId] });
  for (const l of fs.rows) {
    const para = classificarArea(materia, base, {
      principal: String(l.frente),
      correta: String(l.verso),
      leiReferencia: l.lei_referencia ? String(l.lei_referencia) : null,
    });
    if (para) mudancas.push({ tabela: "flashcards", disciplinaId, id: Number(l.id), de: base, para, texto: String(l.frente).slice(0, 160) });
  }
}

for (const { id: disciplinaId, nome: materia } of disciplinas) {
  const areas = await areasDoBanco(disciplinaId);
  for (const base of areasBase(materia)) {
    const baseId = areas.get(chaveNome(base));
    if (baseId) await examinar(disciplinaId, materia, base, baseId);
  }
}

mkdirSync("data/publicacao", { recursive: true });
writeFileSync("data/publicacao/reclassificar-crimes.json", JSON.stringify({ resumo, mudancas }, null, 2));
for (const [base, conta] of Object.entries(resumo)) {
  console.log(`\n${base}:`, Object.entries(conta).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" | "));
}
console.log(`\n${mudancas.filter((m) => m.tabela === "questoes").length} questões e ${mudancas.filter((m) => m.tabela === "flashcards").length} flashcards a mover. Lista em data/publicacao/reclassificar-crimes.json`);

if (!APLICAR) {
  console.log("Só leitura. Confira a lista e rode com --aplicar.");
  process.exit(0);
}

// Cria as áreas que ainda não existem.
const areasPorMateria = new Map<number, Map<string, number>>();
for (const disciplinaId of new Set(mudancas.map((m) => m.disciplinaId))) {
  const existentes = await areasDoBanco(disciplinaId);
  for (const nome of new Set(mudancas.filter((m) => m.disciplinaId === disciplinaId).map((m) => m.para))) {
    if (existentes.has(chaveNome(nome))) continue;
    await prod.execute({ sql: "insert into assuntos (disciplina_id, nome) values (?, ?) on conflict do nothing", args: [disciplinaId, nome] });
  }
  areasPorMateria.set(disciplinaId, await areasDoBanco(disciplinaId));
}

const LOTE = 200;
const grupos = new Map<string, Mudanca[]>();
for (const m of mudancas) {
  const chave = `${m.tabela}|${m.disciplinaId}|${m.de}|${m.para}`;
  grupos.set(chave, [...(grupos.get(chave) ?? []), m]);
}
for (const lista of grupos.values()) {
  const { tabela, disciplinaId, de, para } = lista[0]!;
  const areas = areasPorMateria.get(disciplinaId)!;
  const deId = areas.get(chaveNome(de))!;
  const paraId = areas.get(chaveNome(para));
  if (!paraId) throw new Error(`Área "${para}" não foi criada`);
  for (let i = 0; i < lista.length; i += LOTE) {
    const ids = lista.slice(i, i + LOTE).map((m) => m.id);
    await prod.execute({
      sql: `update ${tabela} set assunto_id = ? where assunto_id = ? and id in (${ids.map(() => "?").join(",")})`,
      args: [paraId, deId, ...ids],
    });
  }
}
await recontar(drizzle(prod, { schema }) as unknown as Db);
console.log("Movidas e contagens recalculadas.");
