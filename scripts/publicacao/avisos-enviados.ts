// Cria a tabela "avisos_enviados" (quem já recebeu cada aviso por e-mail, ex.: simulado liberado).
// Só acrescenta: não mexe em nenhuma outra tabela. Pode rodar de novo (não recria se já existir).
//
// ATENÇÃO: o aviso de simulado liberado só começa a ser enviado depois que esta tabela existe. Criar a tabela
// "arma" o envio: na próxima visita a /simulados, os simulados liberados nos últimos 3 dias são avisados.
//
//   npx tsx scripts/publicacao/avisos-enviados.ts             mostra o que faria (não grava)
//   npx tsx scripts/publicacao/avisos-enviados.ts --aplicar   cria a tabela
import "../_env";
import { createClient } from "@libsql/client";

const APLICAR = process.argv.includes("--aplicar");
const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const banco = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
console.log(`Banco: ${url.startsWith("libsql://") ? "produção (Turso)" : url}`);

const CRIAR = `CREATE TABLE IF NOT EXISTS avisos_enviados (
  chave text NOT NULL,
  usuario_id text NOT NULL,
  enviado_em integer NOT NULL,
  PRIMARY KEY (chave, usuario_id)
)`;

const existe = (await banco.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'avisos_enviados'")).rows.length > 0;
console.log(existe ? "A tabela avisos_enviados já existe." : "A tabela avisos_enviados ainda não existe.");
if (existe) process.exit(0);
if (!APLICAR) {
  console.log("Nada gravado. Rode com --aplicar para criar a tabela (isso liga o aviso por e-mail dos simulados).");
  process.exit(0);
}
await banco.execute(CRIAR);
console.log("Tabela criada. O aviso por e-mail dos simulados está ligado.");
