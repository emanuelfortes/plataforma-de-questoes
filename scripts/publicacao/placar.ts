// Cria a tabela "placar" (ranking) e preenche com o histórico que já existe: para cada aluno, as questões
// diferentes que respondeu, quantas acertou na PRIMEIRA tentativa e a sequência de acertos (atual e recorde),
// com a mesma regra de responderQuestao (chute não conta).
// Só acrescenta: não mexe em nenhuma outra tabela. Pode rodar de novo (recalcula o placar do zero).
//
//   npx tsx scripts/publicacao/placar.ts             mostra o que faria (não grava)
//   npx tsx scripts/publicacao/placar.ts --aplicar   cria a tabela (se faltar) e recalcula o placar
import "../_env";
import { createClient } from "@libsql/client";
import { SEGUNDOS_CHUTE } from "../../src/lib/patentes";

const APLICAR = process.argv.includes("--aplicar");
const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const banco = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
console.log(`Banco: ${url.startsWith("libsql://") ? "produção (Turso)" : url}`);

const CRIAR = [
  `CREATE TABLE IF NOT EXISTS placar (
    usuario_id text PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE cascade,
    resolvidas integer DEFAULT 0 NOT NULL,
    acertos integer DEFAULT 0 NOT NULL,
    sequencia integer DEFAULT 0 NOT NULL,
    maior_sequencia integer DEFAULT 0 NOT NULL,
    atualizado_em integer NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS placar_resolvidas ON placar (resolvidas)`,
];

// Tabela criada antes da sequência de acertos: acrescenta as colunas que faltam (não apaga nada).
const colunas = new Set((await banco.execute("SELECT name FROM pragma_table_info('placar')")).rows.map((r) => String(r.name)));
const NOVAS = colunas.size
  ? ["sequencia", "maior_sequencia"].filter((c) => !colunas.has(c)).map((c) => `ALTER TABLE placar ADD COLUMN ${c} integer DEFAULT 0 NOT NULL`)
  : [];

// Mesma regra de responderQuestao, aplicada ao histórico em ordem: só a primeira tentativa de cada questão
// conta, e não conta se foi chute (menos de SEGUNDOS_CHUTE depois da resposta anterior do aluno).
// Um erro que conta zera a sequência; refazer e chute não mexem nela.
type Placar = { resolvidas: number; acertos: number; sequencia: number; maior: number };
const historico = await banco.execute(
  "SELECT usuario_id, questao_id, correta, respondida_em FROM respostas ORDER BY usuario_id, respondida_em, id",
);
const placares = new Map<string, Placar>();
let aluno = "";
let vistas = new Set<number>();
let anterior: number | null = null;
for (const r of historico.rows) {
  const u = String(r.usuario_id);
  if (u !== aluno) {
    aluno = u;
    vistas = new Set();
    anterior = null;
  }
  const quando = Number(r.respondida_em);
  const primeira = !vistas.has(Number(r.questao_id));
  const chute = anterior !== null && quando - anterior < SEGUNDOS_CHUTE;
  vistas.add(Number(r.questao_id));
  anterior = quando;
  if (!primeira || chute) continue;
  const p = placares.get(u) ?? { resolvidas: 0, acertos: 0, sequencia: 0, maior: 0 };
  p.resolvidas++;
  if (Number(r.correta)) {
    p.acertos++;
    p.sequencia++;
    p.maior = Math.max(p.maior, p.sequencia);
  } else p.sequencia = 0;
  placares.set(u, p);
}

const soma = [...placares.values()].reduce((t, p) => ({ resolvidas: t.resolvidas + p.resolvidas, acertos: t.acertos + p.acertos }), { resolvidas: 0, acertos: 0 });
console.log(`Respostas lidas: ${historico.rows.length} | alunos: ${placares.size} | questões que contam: ${soma.resolvidas} | acertos de primeira: ${soma.acertos}`);
if (NOVAS.length) console.log(`Colunas a acrescentar: ${NOVAS.length}`);

if (!APLICAR) {
  console.log("Só leitura. Rode com --aplicar para criar a tabela e gravar o placar.");
  process.exit(0);
}

const agora = Math.floor(Date.now() / 1000);
await banco.batch(
  [
    ...CRIAR,
    ...NOVAS,
    "DELETE FROM placar",
    ...[...placares].map(([u, p]) => ({
      sql: "INSERT INTO placar (usuario_id, resolvidas, acertos, sequencia, maior_sequencia, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)",
      args: [u, p.resolvidas, p.acertos, p.sequencia, p.maior, agora],
    })),
  ],
  "write",
);
const conferir = await banco.execute("SELECT COUNT(*) alunos, SUM(resolvidas) resolvidas, MAX(maior_sequencia) recorde FROM placar");
const c = conferir.rows[0]!;
console.log(`Placar gravado: ${c.alunos} alunos, ${c.resolvidas} questões resolvidas, maior sequência ${c.recorde}.`);
