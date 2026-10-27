// Prepara o bloqueio de questões repetidas (coluna questoes.chave_enunciado, com índice):
//  1. acrescenta a coluna, se faltar, e grava a chave de cada questão (o enunciado, ver chaveEnunciado);
//  2. procura a mesma pergunta já repetida: mesma chave e resposta correta parecida (mesmaResposta). A mais
//     antiga fica; as cópias saem do ar (suspensa, sem apagar: o histórico de quem respondeu continua) e das contagens;
//  3. cria o índice. Daí em diante a importação e a aprovação ignoram a mesma pergunta (src/db/importacao.ts).
// Pode rodar de novo: só mexe no que mudou.
//
//   npx tsx scripts/publicacao/chave-enunciado.ts             mostra o que faria (não grava)
//   npx tsx scripts/publicacao/chave-enunciado.ts --aplicar   grava
import "../_env";
import { createClient, type InStatement } from "@libsql/client";
import { chaveEnunciado, mesmaResposta } from "../../src/db/importacao";
import { chavesDoItem } from "../../src/lib/contagens";

const APLICAR = process.argv.includes("--aplicar");
const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const banco = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
console.log(`Banco: ${url.startsWith("libsql://") ? "produção (Turso)" : url}`);

const colunas = new Set((await banco.execute("SELECT name FROM pragma_table_info('questoes')")).rows.map((r) => String(r.name)));
const temColuna = colunas.has("chave_enunciado");

const linhas = (
  await banco.execute(
    `SELECT id, disciplina_id, assunto_id, dificuldade, enunciado, alternativas, gabarito, suspensa${temColuna ? ", chave_enunciado" : ""}
     FROM questoes ORDER BY id`,
  )
).rows;

type Linha = { id: number; disciplinaId: number; assuntoId: number | null; dificuldade: number | null; alternativas: { letra: string; texto: string }[]; correta: string; suspensa: boolean; atual: string | null; chave: string };
const questoes: Linha[] = linhas.map((r) => {
  const alternativas = JSON.parse(String(r.alternativas)) as { letra: string; texto: string }[];
  const correta = alternativas.find((a) => a.letra === r.gabarito)?.texto ?? "";
  return {
    id: Number(r.id),
    disciplinaId: Number(r.disciplina_id),
    assuntoId: r.assunto_id === null ? null : Number(r.assunto_id),
    dificuldade: r.dificuldade === null ? null : Number(r.dificuldade),
    alternativas,
    correta,
    suspensa: Boolean(Number(r.suspensa)),
    atual: temColuna && r.chave_enunciado !== null ? String(r.chave_enunciado) : null,
    chave: chaveEnunciado(String(r.enunciado)),
  };
});

// Dentro de cada chave, a original é a mais antiga no ar (depois as fora do ar); cópia é quem tem resposta
// correta parecida com uma original já escolhida.
const grupos = new Map<string, Linha[]>();
for (const q of questoes) grupos.set(q.chave, [...(grupos.get(q.chave) ?? []), q]);
const originalDe = new Map<Linha, Linha>();
let perguntas = 0;
for (const g of grupos.values()) {
  const mantidas: Linha[] = [];
  for (const q of [...g].sort((a, b) => Number(a.suspensa) - Number(b.suspensa) || a.id - b.id)) {
    const igual = mantidas.find((m) => mesmaResposta(m.correta, q.correta));
    if (igual) originalDe.set(q, igual);
    else mantidas.push(q);
  }
  perguntas += mantidas.length;
}
const copias = questoes.filter((q) => originalDe.has(q));
const tirarDoAr = copias.filter((q) => !q.suspensa);
const atualizar = questoes.filter((q) => q.chave !== q.atual);

console.log(`Questões: ${questoes.length} | perguntas diferentes: ${perguntas} | cópias: ${copias.length} (no ar: ${tirarDoAr.length})`);
for (const c of copias) console.log(`  cópia #${c.id} da #${originalDe.get(c)!.id}${c.suspensa ? " (já fora do ar)" : ""}`);
console.log(`Chaves a gravar: ${atualizar.length}${temColuna ? "" : " (e a coluna nova)"}`);

if (!APLICAR) {
  console.log("Só leitura. Rode com --aplicar para gravar.");
  process.exit(0);
}

if (!temColuna) await banco.execute("ALTER TABLE questoes ADD COLUMN chave_enunciado text");
const comandos: InStatement[] = atualizar.map((q) => ({ sql: "UPDATE questoes SET chave_enunciado = ? WHERE id = ?", args: [q.chave, q.id] }));
for (let i = 0; i < comandos.length; i += 500) {
  await banco.batch(comandos.slice(i, i + 500), "write");
  console.log(`  ${Math.min(i + 500, comandos.length)} de ${comandos.length}`);
}

// Cópias que estavam no ar: saem do ar e das contagens (a mesma regra de src/db/aprovacao.ts).
const saida: InStatement[] = [];
for (const q of tirarDoAr) {
  saida.push({ sql: "UPDATE questoes SET suspensa = 1 WHERE id = ? AND suspensa = 0", args: [q.id] });
  for (const chave of chavesDoItem("q", q)) saida.push({ sql: "UPDATE contagens SET total = max(total - 1, 0) WHERE chave = ?", args: [chave] });
}
if (saida.length) await banco.batch(saida, "write");

await banco.execute("CREATE INDEX IF NOT EXISTS questoes_chave_enunciado ON questoes (chave_enunciado)");
const [{ n } = { n: 0 }] = (await banco.execute("SELECT COUNT(*) n FROM questoes WHERE chave_enunciado IS NOT NULL")).rows as unknown as { n: number }[];
console.log(`Pronto: ${n} questões com chave, ${tirarDoAr.length} cópias tiradas do ar, índice criado.`);
