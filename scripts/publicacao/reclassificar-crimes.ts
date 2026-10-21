// Divide as questões e flashcards dos títulos do CP ("Crimes contra a Pessoa", "Crimes contra o Patrimônio"...)
// nas áreas de cada crime ("Homicídio", "Feminicídio", "Roubo"...), as pastas da tela de filtro
// (data/ordem-areas.json). Mesmo id: o histórico dos alunos não muda; só a área.
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
const MATERIA = "Direito Penal";

const url = process.env.TURSO_DATABASE_URL ?? "";
if (!url.startsWith("libsql://")) throw new Error("TURSO_DATABASE_URL não é um banco Turso");
const prod = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const disciplina = await prod.execute({ sql: "select id from disciplinas where nome = ?", args: [MATERIA] });
const disciplinaId = Number(disciplina.rows[0]?.id);
if (!disciplinaId) throw new Error(`Matéria "${MATERIA}" não encontrada`);

async function areasDoBanco() {
  const r = await prod.execute({ sql: "select id, nome from assuntos where disciplina_id = ?", args: [disciplinaId] });
  return new Map(r.rows.map((l) => [chaveNome(String(l.nome)), Number(l.id)]));
}
let areas = await areasDoBanco();

type Mudanca = { tabela: "questoes" | "flashcards"; id: number; de: string; para: string; texto: string };
const mudancas: Mudanca[] = [];
const resumo: Record<string, Record<string, number>> = {};

for (const base of areasBase(MATERIA)) {
  const baseId = areas.get(chaveNome(base));
  if (!baseId) continue;
  const conta = (resumo[base] ??= {});

  const qs = await prod.execute({
    sql: "select id, enunciado, alternativas, gabarito, comentario, lei_referencia from questoes where assunto_id = ?",
    args: [baseId],
  });
  for (const l of qs.rows) {
    const alts = JSON.parse(String(l.alternativas)) as { letra: string; texto: string }[];
    const para = classificarArea(MATERIA, base, {
      principal: String(l.enunciado),
      correta: alts.find((a) => a.letra === l.gabarito)?.texto,
      resto: [String(l.comentario ?? ""), ...alts.filter((a) => a.letra !== l.gabarito).map((a) => a.texto)].join(" "),
      leiReferencia: l.lei_referencia ? String(l.lei_referencia) : null,
    });
    conta[para ?? "(fica)"] = (conta[para ?? "(fica)"] ?? 0) + 1;
    if (para) mudancas.push({ tabela: "questoes", id: Number(l.id), de: base, para, texto: String(l.enunciado).slice(0, 160) });
  }

  const fs = await prod.execute({ sql: "select id, frente, verso, lei_referencia from flashcards where assunto_id = ?", args: [baseId] });
  for (const l of fs.rows) {
    const para = classificarArea(MATERIA, base, {
      principal: String(l.frente),
      correta: String(l.verso),
      leiReferencia: l.lei_referencia ? String(l.lei_referencia) : null,
    });
    if (para) mudancas.push({ tabela: "flashcards", id: Number(l.id), de: base, para, texto: String(l.frente).slice(0, 160) });
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

// Cria as áreas de crime que ainda não existem.
for (const nome of new Set(mudancas.map((m) => m.para))) {
  if (areas.has(chaveNome(nome))) continue;
  await prod.execute({ sql: "insert into assuntos (disciplina_id, nome) values (?, ?) on conflict do nothing", args: [disciplinaId, nome] });
}
areas = await areasDoBanco();

const LOTE = 200;
const grupos = new Map<string, Mudanca[]>();
for (const m of mudancas) {
  const chave = `${m.tabela}|${m.de}|${m.para}`;
  grupos.set(chave, [...(grupos.get(chave) ?? []), m]);
}
for (const lista of grupos.values()) {
  const { tabela, de, para } = lista[0]!;
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
