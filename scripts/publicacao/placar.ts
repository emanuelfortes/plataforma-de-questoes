// Cria a tabela "placar" (ranking) e preenche com o histórico que já existe: para cada aluno, as questões
// diferentes que respondeu e quantas acertou na PRIMEIRA tentativa (a mesma regra de responderQuestao).
// Só acrescenta: não mexe em nenhuma outra tabela. Pode rodar de novo (recalcula o placar do zero).
//
//   npx tsx scripts/publicacao/placar.ts             mostra o que faria (não grava)
//   npx tsx scripts/publicacao/placar.ts --aplicar   cria a tabela (se faltar) e recalcula o placar
import "../_env";
import { createClient } from "@libsql/client";

const APLICAR = process.argv.includes("--aplicar");
const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const banco = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
console.log(`Banco: ${url.startsWith("libsql://") ? "produção (Turso)" : url}`);

const CRIAR = [
  `CREATE TABLE IF NOT EXISTS placar (
    usuario_id text PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE cascade,
    resolvidas integer DEFAULT 0 NOT NULL,
    acertos integer DEFAULT 0 NOT NULL,
    atualizado_em integer NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS placar_resolvidas ON placar (resolvidas)`,
];

// Primeira tentativa de cada (aluno, questão): a de menor id no histórico.
const CALCULO = `
  SELECT usuario_id, COUNT(*) AS resolvidas, SUM(correta) AS acertos
  FROM (
    SELECT usuario_id, correta, ROW_NUMBER() OVER (PARTITION BY usuario_id, questao_id ORDER BY id) AS n
    FROM respostas
  )
  WHERE n = 1
  GROUP BY usuario_id`;

const previa = await banco.execute(`SELECT COUNT(*) alunos, SUM(resolvidas) resolvidas, SUM(acertos) acertos FROM (${CALCULO})`);
const p = previa.rows[0]!;
console.log(`Alunos com resposta: ${p.alunos} | questões resolvidas (somadas): ${p.resolvidas} | acertos de primeira: ${p.acertos}`);

if (!APLICAR) {
  console.log("Só leitura. Rode com --aplicar para criar a tabela e gravar o placar.");
  process.exit(0);
}

const agora = Math.floor(Date.now() / 1000);
await banco.batch(
  [
    ...CRIAR,
    "DELETE FROM placar",
    `INSERT INTO placar (usuario_id, resolvidas, acertos, atualizado_em)
     SELECT usuario_id, resolvidas, acertos, ${agora} FROM (${CALCULO})`,
  ],
  "write",
);
const conferir = await banco.execute("SELECT COUNT(*) alunos, SUM(resolvidas) resolvidas FROM placar");
console.log(`Placar gravado: ${conferir.rows[0]!.alunos} alunos, ${conferir.rows[0]!.resolvidas} questões resolvidas.`);
