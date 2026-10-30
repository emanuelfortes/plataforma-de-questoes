// Reequilibra a letra do gabarito nas questões de 5 alternativas importadas pelo chat (origem nula),
// que vieram com "E" em 40 a 50% das vezes. Por matéria, troca a posição da alternativa correta (E) com a
// de uma letra que está em falta, até cada letra ficar perto de 20%. Nenhum texto muda: só a ordem.
// Mesmo id: o histórico dos alunos (acertou/errou) não muda.
//
// Ficam de fora: questões de combinação ("apenas I e II", "todas"), em que a ordem das alternativas
// tem lógica, e as que citam letra no comentário (ficaria errado).
//
//   npx tsx scripts/publicacao/reequilibrar-letras.ts             só mostra antes e depois (grava data/publicacao/reequilibrar-letras.json)
//   npx tsx scripts/publicacao/reequilibrar-letras.ts --aplicar   grava na produção
//
// Antes de aplicar: npx tsx scripts/publicacao/backup-producao.ts reequilibrar-letras
import "../_env";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const APLICAR = process.argv.includes("--aplicar");
const LETRAS = ["A", "B", "C", "D", "E"];
const COMBINACAO = /\b(I|II|III|IV)\b.*\b(e|,)\b|\bapenas\b|\bsomente\b|\btodas\b|\bnenhuma\b/i;
// Qualquer letra de alternativa no comentário: "letra B", "alternativa B" ou a análise "A) ... B) ...".
// (Na primeira rodada só a primeira forma foi excluída; corrigido em corrigir-letras-comentario.ts.)
const CITA_LETRA = /\b(?:[Ll]etra|[Aa]lternativa)\s+["“(]?[A-E]\b|(^|\s)\(?[A-E]\)\s/;

const url = process.env.TURSO_DATABASE_URL ?? "";
if (!url.startsWith("libsql://")) throw new Error("TURSO_DATABASE_URL não é um banco Turso");
const prod = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

// Sorteio determinístico (rodar de novo dá o mesmo resultado).
let semente = 20261021;
const sorte = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

type Alt = { letra: string; texto: string };
const r = await prod.execute(
  "select q.id, q.gabarito, q.alternativas, q.comentario, d.nome materia from questoes q join disciplinas d on d.id = q.disciplina_id where q.origem is null order by q.id",
);
const qs = r.rows
  .map((l) => ({ id: Number(l.id), gabarito: String(l.gabarito), alts: JSON.parse(String(l.alternativas)) as Alt[], comentario: String(l.comentario ?? ""), materia: String(l.materia) }))
  .filter((q) => q.alts.length === 5);

const distribuicao = (lista: { gabarito: string }[]) =>
  Object.fromEntries(LETRAS.map((x) => [x, Math.round((100 * lista.filter((q) => q.gabarito === x).length) / Math.max(lista.length, 1))]));

const mudancas: { id: number; materia: string; de: string; para: string }[] = [];
const novas = new Map<number, { gabarito: string; alts: Alt[] }>();
const relatorio: Record<string, { questoes: number; antes: Record<string, number>; depois: Record<string, number> }> = {};

for (const materia of [...new Set(qs.map((q) => q.materia))]) {
  const grupo = qs.filter((q) => q.materia === materia);
  const conta = Object.fromEntries(LETRAS.map((x) => [x, grupo.filter((q) => q.gabarito === x).length]));
  const alvo = grupo.length / 5;
  const candidatas = grupo
    .filter((q) => q.gabarito === "E" && !q.alts.some((a) => COMBINACAO.test(a.texto)) && !CITA_LETRA.test(q.comentario))
    .map((q) => ({ q, k: sorte() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.q);
  for (const q of candidatas) {
    if (conta.E! <= Math.round(alvo)) break;
    // Vai para a letra que mais falta (empate: a primeira).
    const para = ["A", "B", "C", "D"].sort((a, b) => conta[a]! - conta[b]!)[0]!;
    if (conta[para]! >= Math.round(alvo)) break;
    const textoE = q.alts.find((a) => a.letra === "E")!.texto;
    const textoPara = q.alts.find((a) => a.letra === para)!.texto;
    const alts = q.alts.map((a) => (a.letra === "E" ? { ...a, texto: textoPara } : a.letra === para ? { ...a, texto: textoE } : a));
    novas.set(q.id, { gabarito: para, alts });
    mudancas.push({ id: q.id, materia, de: "E", para });
    conta.E!--;
    conta[para]!++;
  }
  const depois = grupo.map((q) => ({ gabarito: novas.get(q.id)?.gabarito ?? q.gabarito }));
  relatorio[materia] = { questoes: grupo.length, antes: distribuicao(grupo), depois: distribuicao(depois) };
}

mkdirSync("data/publicacao", { recursive: true });
writeFileSync("data/publicacao/reequilibrar-letras.json", JSON.stringify({ relatorio, mudancas }, null, 2));
const fmt = (d: Record<string, number>) => LETRAS.map((x) => `${x} ${d[x]}%`).join(" ");
for (const [m, v] of Object.entries(relatorio)) console.log(`${m} (${v.questoes}): antes ${fmt(v.antes)}  |  depois ${fmt(v.depois)}`);
const todas = qs.map((q) => ({ gabarito: novas.get(q.id)?.gabarito ?? q.gabarito }));
console.log(`\nTotal (${qs.length}): antes ${fmt(distribuicao(qs))}  |  depois ${fmt(distribuicao(todas))}`);
console.log(`${mudancas.length} questões mudam de letra.`);

if (!APLICAR) {
  console.log("Só leitura. Rode com --aplicar para gravar.");
  process.exit(0);
}
const LOTE = 50;
const lista = [...novas];
for (let i = 0; i < lista.length; i += LOTE) {
  await prod.batch(
    lista.slice(i, i + LOTE).map(([id, n]) => ({
      // "and gabarito = 'E'": se alguém já mexeu na questão, não sobrescreve.
      sql: "update questoes set alternativas = ?, gabarito = ? where id = ? and gabarito = 'E'",
      args: [JSON.stringify(n.alts), n.gabarito, id],
    })),
    "write",
  );
}
console.log("Gravado na produção.");
