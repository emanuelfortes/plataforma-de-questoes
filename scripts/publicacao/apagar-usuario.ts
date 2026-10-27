// Apaga uma conta (de teste) e tudo dela: sessões, login, placar, respostas e estado de estudo.
//
//   npx tsx scripts/publicacao/apagar-usuario.ts email@exemplo.com             mostra o que apagaria
//   npx tsx scripts/publicacao/apagar-usuario.ts email@exemplo.com --aplicar   apaga
import "../_env";
import { createClient } from "@libsql/client";

const email = process.argv[2]?.trim().toLowerCase();
const APLICAR = process.argv.includes("--aplicar");
if (!email || !email.includes("@")) throw new Error("Informe o e-mail da conta.");
const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const banco = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
console.log(`Banco: ${url.startsWith("libsql://") ? "produção (Turso)" : url}`);

const [u] = (await banco.execute({ sql: "SELECT id, name FROM user WHERE lower(email) = ?", args: [email] })).rows;
if (!u) {
  console.log(`Nenhuma conta com ${email}.`);
  process.exit(0);
}
const id = String(u.id);
// Quem tem assinatura ou pagamento não é conta de teste: não apaga (o faturamento depende disso).
const [{ pagou } = { pagou: 0 }] = (await banco.execute({ sql: "SELECT (SELECT COUNT(*) FROM assinaturas WHERE usuario_id = ?) + (SELECT COUNT(*) FROM pagamentos WHERE usuario_id = ?) pagou", args: [id, id] })).rows as unknown as { pagou: number }[];
if (Number(pagou) > 0) throw new Error("Esta conta tem assinatura ou pagamento: não apago por aqui.");
const TABELAS = ["session", "account", "placar", "respostas", "status_questao", "revisoes_flashcard", "reportes"] as const;
const COLUNA: Record<(typeof TABELAS)[number], string> = {
  session: "user_id",
  account: "user_id",
  placar: "usuario_id",
  respostas: "usuario_id",
  status_questao: "usuario_id",
  revisoes_flashcard: "usuario_id",
  reportes: "usuario_id",
};
for (const t of TABELAS) {
  const [{ n } = { n: 0 }] = (await banco.execute({ sql: `SELECT COUNT(*) n FROM ${t} WHERE ${COLUNA[t]} = ?`, args: [id] })).rows as unknown as { n: number }[];
  console.log(`  ${t}: ${n}`);
}
console.log(`Conta: ${u.name} <${email}>`);
if (!APLICAR) {
  console.log("Só leitura. Rode com --aplicar para apagar.");
  process.exit(0);
}
await banco.batch(
  [...TABELAS.map((t) => ({ sql: `DELETE FROM ${t} WHERE ${COLUNA[t]} = ?`, args: [id] })), { sql: "DELETE FROM user WHERE id = ?", args: [id] }],
  "write",
);
console.log("Conta apagada.");
