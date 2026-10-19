// Remove os dados de exemplo (npm run exemplo): questões "q_0000001..." e flashcards "f_0000001..."
// cujo texto começa com "(Exemplo N)", com tudo o que está ligado a eles, e recalcula as contagens.
//
//   npx tsx scripts/remover-exemplo.ts                       só mostra o que seria apagado (local.db)
//   npx tsx scripts/remover-exemplo.ts --confirmar           apaga no local.db
//   npx tsx scripts/remover-exemplo.ts --producao            só mostra, no banco do .env.local (Turso)
//   npx tsx scripts/remover-exemplo.ts --producao --confirmar  apaga na produção (só com aprovação do dono)
//
// Ordem: respostas, status_questao e revisoes_flashcard dos itens de exemplo; depois os itens;
// depois áreas e matérias que ficaram sem nada; por fim a recontagem (tabela contagens).
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { recontar } from "./lib/recontar";
import * as schema from "../src/db/schema";

const args = process.argv.slice(2);
const PRODUCAO = args.includes("--producao");
const CONFIRMAR = args.includes("--confirmar");
if (PRODUCAO) await import("./_env");
const url = PRODUCAO ? process.env.TURSO_DATABASE_URL : "file:local.db";
if (!url) throw new Error("TURSO_DATABASE_URL ausente no .env.local");
const cliente = createClient({ url, authToken: PRODUCAO ? process.env.TURSO_AUTH_TOKEN : undefined });

// Critério duplo (código E texto): uma questão real nunca casa os dois por acaso.
const Q = "(codigo glob 'q_[0-9]*' and enunciado like '(Exemplo %')";
const F = "(codigo glob 'f_[0-9]*' and frente like '(Exemplo %')";
const PASSOS: [string, string][] = [
  ["respostas", `delete from respostas where questao_id in (select id from questoes where ${Q})`],
  ["status_questao", `delete from status_questao where questao_id in (select id from questoes where ${Q})`],
  ["revisoes_flashcard", `delete from revisoes_flashcard where flashcard_id in (select id from flashcards where ${F})`],
  ["questoes", `delete from questoes where ${Q}`],
  ["flashcards", `delete from flashcards where ${F}`],
  [
    "assuntos sem conteúdo",
    "delete from assuntos where id not in (select assunto_id from questoes where assunto_id is not null) and id not in (select assunto_id from flashcards where assunto_id is not null)",
  ],
  [
    "disciplinas sem conteúdo",
    "delete from disciplinas where id not in (select disciplina_id from questoes) and id not in (select disciplina_id from flashcards) and id not in (select disciplina_id from assuntos)",
  ],
];
// Mesmas condições, em forma de contagem, para a prévia.
const contar = (sqlDelete: string) => sqlDelete.replace(/^delete from (\w+)/, "select count(*) as n from $1");

console.log(`Banco: ${PRODUCAO ? "PRODUÇÃO (.env.local)" : "local.db"} | ${CONFIRMAR ? "APAGANDO" : "só prévia"}`);
for (const [nome, sql] of PASSOS) {
  const n = (await cliente.execute(contar(sql))).rows[0]!.n;
  console.log(`  ${nome}: ${n}`);
}
if (!CONFIRMAR) {
  console.log("Nada foi apagado. Acrescente --confirmar para apagar.");
  process.exit(0);
}
// Tudo ou nada: se um passo falhar, nada fica pela metade.
await cliente.batch(PASSOS.map(([, sql]) => sql), "write");
await recontar(drizzle(cliente, { schema }));
console.log("Dados de exemplo removidos e contagens recalculadas.");
