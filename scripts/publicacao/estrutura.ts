// Estrutura nova na produção sem o drizzle-kit (que recriaria "questoes" e "flashcards" para
// acrescentar as colunas NOT NULL). Compara o local.db com o Turso e gera só o que falta:
// CREATE TABLE/INDEX das tabelas novas e ALTER TABLE ADD COLUMN nas existentes.
//
//   npx tsx scripts/publicacao/estrutura.ts             gera data/publicacao/estrutura-producao.sql (não aplica)
//   npx tsx scripts/publicacao/estrutura.ts --aplicar   aplica no Turso (tudo numa transação)
import "../_env";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const APLICAR = process.argv.includes("--aplicar");
const url = process.env.TURSO_DATABASE_URL ?? "";
if (!url.startsWith("libsql://")) throw new Error("TURSO_DATABASE_URL não é um banco Turso");
const prod = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const local = createClient({ url: "file:local.db" });

const TABELAS_NOVAS = ["questoes_revisao", "flashcards_revisao", "reportes"];
const COM_COLUNAS_NOVAS = ["questoes", "flashcards"];

const esquema = async (c: typeof prod) =>
  (await c.execute("select type, name, tbl_name, sql from sqlite_master where sql is not null")).rows.map((r) => ({
    type: String(r.type),
    name: String(r.name),
    tabela: String(r.tbl_name),
    sql: String(r.sql),
  }));
const colunas = async (c: typeof prod, t: string) => (await c.execute(`pragma table_info(${t})`)).rows.map((r) => ({ nome: String(r.name), tipo: String(r.type), notnull: Number(r.notnull), padrao: r.dflt_value }));

const [eLocal, eProd] = [await esquema(local), await esquema(prod)];
const existe = new Set(eProd.map((e) => e.name));
const comandos: string[] = [];

for (const t of TABELAS_NOVAS) {
  if (existe.has(t)) continue;
  for (const e of eLocal.filter((x) => x.tabela === t).sort((a, b) => (a.type === "table" ? -1 : b.type === "table" ? 1 : 0))) comandos.push(`${e.sql};`);
}
for (const t of COM_COLUNAS_NOVAS) {
  const naProd = new Set((await colunas(prod, t)).map((c) => c.nome));
  for (const c of await colunas(local, t)) {
    if (naProd.has(c.nome)) continue;
    // ADD COLUMN NOT NULL exige padrão; as colunas novas são nulas ou têm padrão (suspensa = false).
    if (c.notnull && c.padrao === null) throw new Error(`coluna ${t}.${c.nome} é NOT NULL sem padrão: não dá para acrescentar com ALTER`);
    comandos.push(`ALTER TABLE \`${t}\` ADD COLUMN \`${c.nome}\` ${c.tipo}${c.padrao !== null ? ` DEFAULT ${c.padrao}` : ""}${c.notnull ? " NOT NULL" : ""};`);
  }
  for (const e of eLocal.filter((x) => x.tabela === t && x.type === "index" && !existe.has(x.name))) comandos.push(`${e.sql};`);
}

mkdirSync("data/publicacao", { recursive: true });
const arquivo = "data/publicacao/estrutura-producao.sql";
// Sem nada a fazer, não sobrescreve o registro do que já foi aplicado.
if (!comandos.length) {
  console.log("A produção já tem toda a estrutura; nada a gerar.");
  process.exit(0);
}
writeFileSync(arquivo, `-- Estrutura nova para a produção (gerado em ${new Date().toISOString()}).\n-- Só acrescenta: nenhuma tabela existente é recriada e nenhum dado é apagado.\n\n${comandos.join("\n\n")}\n`);
console.log(`${comandos.length} comandos em ${arquivo}`);
if (APLICAR) {
  if (!comandos.length) console.log("Nada a aplicar.");
  else {
    await prod.batch(comandos, "write");
    console.log("Estrutura aplicada no Turso.");
  }
}
