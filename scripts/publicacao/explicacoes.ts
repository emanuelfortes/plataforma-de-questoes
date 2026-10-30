// Explicações do Vade Mecum ("Entender este artigo"): cria a tabela explicacoes_artigo (se faltar) e carrega um
// lote escrito pela IA como PENDENTE. O professor aprova em /admin/vade-mecum; só então o aluno vê.
// Nunca sobrescreve uma explicação já aprovada (rodar de novo é seguro).
//
//   npx tsx scripts/publicacao/explicacoes.ts data/vade-mecum/explicacoes-lote-1.json             confere (não grava)
//   npx tsx scripts/publicacao/explicacoes.ts data/vade-mecum/explicacoes-lote-1.json --aplicar   grava
import "../_env";
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { z } from "zod";
import { esquemaExplicacao } from "../../src/lib/explicacao";

const APLICAR = process.argv.includes("--aplicar");
const arquivo = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!arquivo) throw new Error("Informe o arquivo do lote (ex.: data/vade-mecum/explicacoes-lote-1.json)");
const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const banco = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
console.log(`Banco: ${url.startsWith("libsql://") ? "produção (Turso)" : url}`);

const item = esquemaExplicacao.extend({
  lei: z.string().regex(/^[a-z0-9-]{2,30}$/),
  artigo: z.string().regex(/^\d{1,4}(-[A-Z])?$/),
  conferir: z.string().trim().max(1_000).nullable().optional(),
});
const bruto = JSON.parse(readFileSync(arquivo, "utf8")) as unknown[];
const validos: z.infer<typeof item>[] = [];
const problemas: string[] = [];
bruto.forEach((x, i) => {
  const r = item.safeParse(x);
  if (r.success) validos.push(r.data);
  else problemas.push(`item ${i + 1}: ${r.error.issues[0]!.path.join(".")} ${r.error.issues[0]!.message}`);
});
console.log(`Itens: ${bruto.length} | válidos: ${validos.length} | com problema: ${problemas.length} | para conferir: ${validos.filter((v) => v.conferir).length}`);
for (const p of problemas) console.log(`  ${p}`);

if (!APLICAR) {
  console.log("Só leitura. Rode com --aplicar para gravar.");
  process.exit(0);
}

const agora = Math.floor(Date.now() / 1000);
await banco.batch(
  [
    `CREATE TABLE IF NOT EXISTS explicacoes_artigo (
      lei text NOT NULL,
      artigo text NOT NULL,
      sentido text NOT NULL,
      pontos text NOT NULL,
      exemplo text NOT NULL,
      pegadinha text,
      conferir text,
      status text DEFAULT 'pendente' NOT NULL,
      criado_em integer NOT NULL,
      revisado_em integer,
      revisado_por text,
      PRIMARY KEY (lei, artigo)
    )`,
    "CREATE INDEX IF NOT EXISTS explicacoes_artigo_status ON explicacoes_artigo (status)",
    ...validos.map((v) => ({
      // Já aprovada: fica como está. Pendente ou rejeitada: recebe o texto novo e volta para a fila.
      sql: `INSERT INTO explicacoes_artigo (lei, artigo, sentido, pontos, exemplo, pegadinha, conferir, status, criado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?)
            ON CONFLICT (lei, artigo) DO UPDATE SET sentido = excluded.sentido, pontos = excluded.pontos, exemplo = excluded.exemplo,
              pegadinha = excluded.pegadinha, conferir = excluded.conferir, status = 'pendente'
            WHERE explicacoes_artigo.status <> 'aprovada'`,
      args: [v.lei, v.artigo, v.sentido, JSON.stringify(v.pontos), v.exemplo, v.pegadinha || null, v.conferir || null, agora],
    })),
  ],
  "write",
);
const r = await banco.execute("SELECT status, COUNT(*) n FROM explicacoes_artigo GROUP BY status");
console.log("Gravado. Na tabela:", Object.fromEntries(r.rows.map((x) => [x.status, x.n])));
