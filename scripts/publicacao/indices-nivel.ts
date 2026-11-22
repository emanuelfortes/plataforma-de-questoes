// Cria os índices da lista de questões por nível (uma fila por nível: 50% fácil, 30% médio, 20% difícil;
// listarQuestoes em src/server/questoes.ts). Só acrescenta índices: não muda nenhum dado. Pode rodar de novo.
//
// Rode ANTES de subir o código novo: sem os índices a lista funciona, mas lê muito mais linhas.
//
//   npx tsx scripts/publicacao/indices-nivel.ts             mostra o que falta (não grava)
//   npx tsx scripts/publicacao/indices-nivel.ts --aplicar   cria os índices
import "../_env";
import { createClient } from "@libsql/client";

const APLICAR = process.argv.includes("--aplicar");
const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const banco = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
console.log(`Banco: ${url.startsWith("libsql://") ? "produção (Turso)" : url}`);

const INDICES: Record<string, string> = {
  questoes_nivel_ordem: "CREATE INDEX IF NOT EXISTS questoes_nivel_ordem ON questoes (dificuldade, ordem)",
  questoes_disciplina_nivel_ordem: "CREATE INDEX IF NOT EXISTS questoes_disciplina_nivel_ordem ON questoes (disciplina_id, dificuldade, ordem)",
  questoes_assunto_nivel_ordem: "CREATE INDEX IF NOT EXISTS questoes_assunto_nivel_ordem ON questoes (assunto_id, dificuldade, ordem)",
};

const existentes = new Set(
  (await banco.execute("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'questoes'")).rows.map((r) => String(r.name)),
);
const faltam = Object.keys(INDICES).filter((n) => !existentes.has(n));
if (!faltam.length) {
  console.log("Os três índices já existem.");
  process.exit(0);
}
console.log(`Faltam: ${faltam.join(", ")}`);
if (!APLICAR) {
  console.log("Nada gravado. Rode com --aplicar para criar.");
  process.exit(0);
}
for (const nome of faltam) {
  const t = Date.now();
  await banco.execute(INDICES[nome]!);
  console.log(`Criado ${nome} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
}
