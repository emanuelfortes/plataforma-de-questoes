// Procura questões repetidas no banco (só leitura): idênticas, mesmo enunciado com alternativas diferentes
// e quase iguais (70% ou mais das trincas de palavras em comum, na mesma disciplina).
//
//   npx tsx scripts/publicacao/duplicadas.ts
import "../_env";
import { createClient } from "@libsql/client";
import { normalizar } from "../../src/lib/catalogo";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const banco = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
console.log("Banco:", url.startsWith("libsql://") ? "produção" : url);

const linhas = (await banco.execute(
  `SELECT q.id, q.codigo, q.origem, q.suspensa, d.nome disciplina, a.nome assunto, q.enunciado, q.alternativas, q.gabarito
   FROM questoes q JOIN disciplinas d ON d.id = q.disciplina_id LEFT JOIN assuntos a ON a.id = q.assunto_id`,
)).rows;
console.log("Questões:", linhas.length);

const limpo = (t: string) => normalizar(t).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
type Q = { id: number; codigo: string; origem: string; disc: string; ass: string; enun: string; alts: string; gab: string; sh: Set<string> };
const qs: Q[] = linhas.map((r) => {
  const enun = limpo(String(r.enunciado));
  const alts = (JSON.parse(String(r.alternativas)) as { texto: string }[]).map((a) => limpo(a.texto)).sort().join(" | ");
  const palavras = (enun + " " + alts).split(" ");
  const sh = new Set<string>();
  for (let i = 0; i + 3 <= palavras.length; i++) sh.add(palavras.slice(i, i + 3).join(" "));
  return { id: Number(r.id), codigo: String(r.codigo), origem: String(r.origem ?? "arquivo"), disc: String(r.disciplina), ass: String(r.assunto ?? ""), enun, alts, gab: String(r.gabarito), sh };
});

// 1. Idênticas: mesmo enunciado e mesmas alternativas (texto normalizado)
const porConteudo = new Map<string, Q[]>();
for (const q of qs) { const k = q.enun + "##" + q.alts; porConteudo.set(k, [...(porConteudo.get(k) ?? []), q]); }
const identicas = [...porConteudo.values()].filter((g) => g.length > 1);
// 2. Mesmo enunciado, alternativas diferentes
const porEnun = new Map<string, Q[]>();
for (const q of qs) porEnun.set(q.enun, [...(porEnun.get(q.enun) ?? []), q]);
const mesmoEnun = [...porEnun.values()].filter((g) => g.length > 1 && new Set(g.map((x) => x.alts)).size > 1);
// 3. Quase iguais (Jaccard de trincas de palavras >= 0.7) na mesma disciplina
const LIMITE = Number(process.argv[2] ?? 0.7);
const jac = (a: Set<string>, b: Set<string>) => { let c = 0; for (const x of a) if (b.has(x)) c++; return c / (a.size + b.size - c || 1); };
const porDisc = new Map<string, Q[]>();
for (const q of qs) porDisc.set(q.disc, [...(porDisc.get(q.disc) ?? []), q]);
const quase: [Q, Q, number][] = [];
for (const g of porDisc.values()) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
  const s = jac(g[i]!.sh, g[j]!.sh);
  if (s >= LIMITE && !(g[i]!.enun === g[j]!.enun && g[i]!.alts === g[j]!.alts)) quase.push([g[i]!, g[j]!, s]);
}
quase.sort((a, b) => b[2] - a[2]);

console.log(`\n1. Idênticas: ${identicas.length} grupos (${identicas.reduce((t, g) => t + g.length - 1, 0)} cópias a mais)`);
for (const g of identicas.slice(0, 8)) console.log("  ", g.map((q) => `#${q.id}(${q.origem})`).join(", "), "|", g[0]!.disc, "|", g[0]!.enun.slice(0, 90));
console.log(`\n2. Mesmo enunciado, alternativas diferentes: ${mesmoEnun.length} grupos`);
for (const g of mesmoEnun) console.log("  ", g.map((q) => `#${q.id}`).join(", "), "|", g[0]!.disc, "|", g[0]!.enun.slice(0, 90));
console.log(`\n3. Quase iguais (>= ${Math.round(LIMITE * 100)}% do texto): ${quase.length} pares`);
const faixa = (min: number, max: number) => quase.filter(([, , s]) => s >= min && s < max).length;
console.log(`   90-100%: ${faixa(0.9, 1.01)} | 80-90%: ${faixa(0.8, 0.9)} | 70-80%: ${faixa(0.7, 0.8)}`);
for (const [a, b, s] of quase.slice(0, 15)) console.log(`   ${Math.round(s * 100)}% #${a.id} x #${b.id} | ${a.disc} | ${a.enun.slice(0, 70)}\n${" ".repeat(28)}${b.enun.slice(0, 70)}`);
banco.close();
