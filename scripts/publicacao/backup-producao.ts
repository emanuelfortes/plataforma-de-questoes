// Backup (só leitura) das tabelas de conteúdo da produção (Turso do .env.local) em
// data/backups/AAAA-MM-DD-<rotulo>/: um JSON por tabela, com todas as colunas.
//
//   npx tsx scripts/publicacao/backup-producao.ts [rotulo]     (padrão: pre-publicacao)
import "../_env";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL ?? "";
if (!url.startsWith("libsql://")) throw new Error("TURSO_DATABASE_URL não é um banco Turso");
const cliente = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const hoje = new Date();
const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
const pasta = `data/backups/${data}-${process.argv[2] ?? "pre-publicacao"}`;
mkdirSync(pasta, { recursive: true });

const TABELAS = ["disciplinas", "assuntos", "questoes", "flashcards", "contagens"];
const resumo: Record<string, number> = {};
for (const tabela of TABELAS) {
  const r = await cliente.execute(`select * from ${tabela} order by rowid`);
  const linhas = r.rows.map((l) => Object.fromEntries(r.columns.map((c) => [c, l[c]])));
  writeFileSync(`${pasta}/${tabela}.json`, JSON.stringify({ tabela, colunas: r.columns, total: linhas.length, linhas }, null, 2));
  resumo[tabela] = linhas.length;
}
// Estrutura atual (para comparar depois e para restaurar se precisar).
const esquema = await cliente.execute("select type, name, sql from sqlite_master where sql is not null order by type, name");
writeFileSync(`${pasta}/esquema.sql`, esquema.rows.map((r) => `-- ${r.type} ${r.name}\n${r.sql};`).join("\n\n") + "\n");
writeFileSync(`${pasta}/resumo.json`, JSON.stringify({ quando: hoje.toISOString(), host: new URL(url.replace("libsql:", "https:")).host.split(".")[0], totais: resumo }, null, 2));
console.log(`Backup em ${pasta}:`, resumo);
