// Liga cada questão aos artigos de lei que ela cobra (tabela artigos_questao) e conta as questões de cada
// artigo em "contagens" (chave "v:<lei>:<artigo>"), para o Vade Mecum mostrar "N questões cobram este artigo".
// Lê as questões uma vez. Só acrescenta a tabela nova; pode rodar de novo (refaz do zero).
//
//   npx tsx scripts/publicacao/artigos-questoes.ts             mostra o que faria (não grava)
//   npx tsx scripts/publicacao/artigos-questoes.ts --aplicar   cria a tabela (se faltar) e grava
import "../_env";
import { createClient } from "@libsql/client";
import { artigosDaQuestao } from "../../src/lib/artigos-lei";

const APLICAR = process.argv.includes("--aplicar");
const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const banco = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
console.log(`Banco: ${url.startsWith("libsql://") ? "produção (Turso)" : url}`);

const r = await banco.execute(
  "select q.id, q.lei_referencia, q.comentario, q.suspensa, d.nome disciplina from questoes q join disciplinas d on d.id = q.disciplina_id",
);
const ligacoes: { lei: string; artigo: string; id: number; suspensa: boolean }[] = [];
for (const q of r.rows) {
  for (const a of artigosDaQuestao({ disciplina: String(q.disciplina), leiReferencia: q.lei_referencia ? String(q.lei_referencia) : null, comentario: q.comentario ? String(q.comentario) : null }))
    ligacoes.push({ ...a, id: Number(q.id), suspensa: !!Number(q.suspensa) });
}
const contas = new Map<string, number>();
for (const l of ligacoes) if (!l.suspensa) contas.set(`v:${l.lei}:${l.artigo}`, (contas.get(`v:${l.lei}:${l.artigo}`) ?? 0) + 1);
console.log(`Questões lidas: ${r.rows.length} | ligadas a artigo: ${new Set(ligacoes.map((l) => l.id)).size} | ligações: ${ligacoes.length} | artigos com questão: ${contas.size}`);

if (!APLICAR) {
  console.log("Só leitura. Rode com --aplicar para gravar.");
  process.exit(0);
}

await banco.batch(
  [
    `CREATE TABLE IF NOT EXISTS artigos_questao (
      lei text NOT NULL,
      artigo text NOT NULL,
      questao_id integer NOT NULL REFERENCES questoes(id),
      PRIMARY KEY (lei, artigo, questao_id)
    )`,
    "DELETE FROM artigos_questao",
    "DELETE FROM contagens WHERE chave LIKE 'v:%'",
  ],
  "write",
);
const LOTE = 400;
for (let i = 0; i < ligacoes.length; i += LOTE) {
  await banco.batch(
    ligacoes.slice(i, i + LOTE).map((l) => ({ sql: "INSERT OR IGNORE INTO artigos_questao (lei, artigo, questao_id) VALUES (?, ?, ?)", args: [l.lei, l.artigo, l.id] })),
    "write",
  );
}
const chaves = [...contas];
for (let i = 0; i < chaves.length; i += LOTE) {
  await banco.batch(
    chaves.slice(i, i + LOTE).map(([chave, total]) => ({ sql: "INSERT INTO contagens (chave, total) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET total = excluded.total", args: [chave, total] })),
    "write",
  );
}
console.log("Gravado.");
