// Conserta o comentário das questões que o reequilíbrio de letras (reequilibrar-letras.ts, 21/10/2026) mexeu:
// lá a alternativa correta trocou de lugar com a de outra letra (E <-> X), mas a análise do comentário
// ("A) Errada... E) Correta") continuou com as letras antigas. Aqui a análise recebe a mesma troca:
// o trecho da letra E vai para X e o de X vai para E. Se o comentário cita letra fora da análise (onde a
// troca não é segura), a questão volta a ser como era antes do reequilíbrio (alternativas e gabarito do backup).
//
//   npx tsx scripts/publicacao/corrigir-letras-comentario.ts             mostra o que faria (não grava)
//   npx tsx scripts/publicacao/corrigir-letras-comentario.ts --aplicar   grava na produção
import "../_env";
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { localizarAlternativas, separarComentario } from "../../src/lib/comentario";

const APLICAR = process.argv.includes("--aplicar");
const BACKUP = "data/backups/2026-10-21-reequilibrar-letras/questoes.json";
const url = process.env.TURSO_DATABASE_URL ?? "";
if (!url.startsWith("libsql://")) throw new Error("TURSO_DATABASE_URL não é um banco Turso");
const prod = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

type Alt = { letra: string; texto: string };
const antes = new Map<number, { gabarito: string; alternativas: string; comentario: string }>(
  JSON.parse(readFileSync(BACKUP, "utf8")).linhas.map((q: any) => [q.id, { gabarito: q.gabarito, alternativas: q.alternativas, comentario: String(q.comentario ?? "") }]),
);
const ids = [...antes].filter(([, q]) => q.gabarito === "E").map(([id]) => id);

const ROTULO_FIM = /(^|\n|[.!?;)"”»]\s)\s*(Fundamento|Jurisprudência|Pegadinha|MACETE DO RICCARDO|FIQUE LIGADO|CUIDADO NA PROVA|Atualização|Atenção)[^:\n]{0,20}:/;
const CITA_LETRA = /\b(letra|alternativa)s?\s+[A-E]\b|(^|\s)\(?[A-E]\)\s/;

/** Troca os trechos de duas letras na análise. null se não for seguro (aí a questão volta ao original). */
function trocarNaAnalise(comentario: string, a: string, b: string): string | null {
  const ini = comentario.search(/An[áa]lise das alternativas\s*:/);
  if (ini < 0) return null;
  const inicioBloco = comentario.indexOf(":", ini) + 1;
  const resto = comentario.slice(inicioBloco);
  const fimRel = resto.search(ROTULO_FIM);
  const fimBloco = fimRel < 0 ? comentario.length : inicioBloco + fimRel + (resto.match(ROTULO_FIM)![1]?.length ?? 0);
  const bloco = comentario.slice(inicioBloco, fimBloco);
  if (CITA_LETRA.test(comentario.slice(0, ini)) || CITA_LETRA.test(comentario.slice(fimBloco))) return null;

  const marcas = localizarAlternativas(bloco);
  const trecho = (letra: string) => {
    const i = marcas.findIndex((m) => m.letra === letra);
    if (i < 0) return null;
    const fim = marcas[i + 1]?.inicio ?? bloco.length;
    const bruto = bloco.slice(marcas[i]!.fim, fim);
    const nucleo = bruto.trimEnd();
    return { de: marcas[i]!.fim, ate: marcas[i]!.fim + nucleo.length, nucleo };
  };
  const ta = trecho(a);
  const tb = trecho(b);
  if (!ta || !tb) return null;
  const [p, s] = ta.de < tb.de ? [ta, tb] : [tb, ta];
  const novoBloco = bloco.slice(0, p.de) + s.nucleo + bloco.slice(p.ate, s.de) + p.nucleo + bloco.slice(s.ate);
  return comentario.slice(0, inicioBloco) + novoBloco + comentario.slice(fimBloco);
}

const agora: { id: number; gabarito: string; alternativas: string; comentario: string }[] = [];
for (let i = 0; i < ids.length; i += 200) {
  const parte = ids.slice(i, i + 200);
  const r = await prod.execute({ sql: `select id, gabarito, alternativas, comentario from questoes where id in (${parte.map(() => "?").join(",")})`, args: parte });
  for (const l of r.rows) agora.push({ id: Number(l.id), gabarito: String(l.gabarito), alternativas: String(l.alternativas), comentario: String(l.comentario ?? "") });
}

const corrigir: { id: number; comentario: string }[] = [];
const devolver: { id: number; gabarito: string; alternativas: string }[] = [];
let semLetra = 0;
for (const q of agora) {
  if (q.gabarito === "E") continue; // não foi mexida
  // Comentário já diferente do original de 21/10: já foi corrigido. Nunca troca duas vezes.
  if (q.comentario !== antes.get(q.id)!.comentario) {
    semLetra++;
    continue;
  }
  if (!CITA_LETRA.test(q.comentario)) {
    semLetra++; // comentário não fala de letra: está certo como está
    continue;
  }
  // Já corrigida (a análise aponta a letra do gabarito): não mexe de novo. Assim o script pode rodar outra vez.
  const atual = separarComentario(q.comentario).find((p) => p.tipo === "alternativas");
  const corretaAtual = atual && atual.tipo === "alternativas" ? atual.itens.filter((i) => i.estado === "correta").map((i) => i.letra) : [];
  if (corretaAtual.length === 1 && corretaAtual[0] === q.gabarito) {
    semLetra++;
    continue;
  }
  const novo = trocarNaAnalise(q.comentario, "E", q.gabarito);
  // Confere: depois da troca, se a análise diz qual é a correta, tem de ser a letra do gabarito.
  const alt = novo ? separarComentario(novo).find((p) => p.tipo === "alternativas") : undefined;
  const corretas = alt && alt.tipo === "alternativas" ? alt.itens.filter((i) => i.estado === "correta").map((i) => i.letra) : [];
  if (novo && (corretas.length === 0 || (corretas.length === 1 && corretas[0] === q.gabarito))) corrigir.push({ id: q.id, comentario: novo });
  else devolver.push({ id: q.id, ...antes.get(q.id)! });
}

console.log(`Reequilibradas: ${agora.filter((q) => q.gabarito !== "E").length} | comentário sem letra (ok): ${semLetra} | análise corrigida: ${corrigir.length} | voltam ao original: ${devolver.length}`);
const ex = corrigir[0];
if (ex) {
  const velho = agora.find((q) => q.id === ex.id)!.comentario;
  console.log(`\nExemplo #${ex.id} (gabarito ${agora.find((q) => q.id === ex.id)!.gabarito}):\nANTES: ${velho.slice(velho.search(/An[áa]lise/), velho.search(/An[áa]lise/) + 400)}\nDEPOIS: ${ex.comentario.slice(ex.comentario.search(/An[áa]lise/), ex.comentario.search(/An[áa]lise/) + 400)}`);
}
if (!APLICAR) {
  console.log("\nSó leitura. Rode com --aplicar para gravar.");
  process.exit(0);
}
await prod.batch(
  [
    ...corrigir.map((c) => ({ sql: "update questoes set comentario = ? where id = ?", args: [c.comentario, c.id] })),
    ...devolver.map((d) => ({ sql: "update questoes set gabarito = ?, alternativas = ? where id = ?", args: [d.gabarito, d.alternativas, d.id] })),
  ],
  "write",
);
console.log("Gravado na produção.");
