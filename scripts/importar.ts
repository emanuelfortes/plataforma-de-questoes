// Importa questões e flashcards de um arquivo .jsonl (uma linha = um objeto).
// Uso: npm run importar -- caminho/do/arquivo.jsonl
//
// Pode rodar quantas vezes quiser: itens com "id" já importado são ignorados (não duplica, não sobrescreve).
// Linhas inválidas vão para data/erros-importacao.log com o número da linha e o motivo.
import "./_env";
import { createReadStream } from "node:fs";
import { appendFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { assuntos, disciplinas, flashcards, questoes } from "../src/db/schema";
import { esquemaLinha, type LinhaFlashcard, type LinhaQuestao } from "../src/lib/formato-jsonl";
import { recontar } from "./lib/recontar";

const ARQUIVO = process.argv[2] ?? "data/exemplo.jsonl";
const ARQUIVO_ERROS = "data/erros-importacao.log";
// 500 linhas por INSERT: poucas idas ao banco e bem abaixo do limite de variáveis do SQLite.
const LOTE = 500;

const stats = { linhas: 0, invalidas: 0, questoes: 0, flashcards: 0, ignoradas: 0 };

// Cache de nomes para ids: evita uma consulta por linha.
const idsDisciplina = new Map<string, number>();
const idsAssunto = new Map<string, number>(); // chave: `${disciplinaId}::${nome}`

async function carregarCaches() {
  for (const d of await db.select().from(disciplinas)) idsDisciplina.set(d.nome, d.id);
  for (const a of await db.select().from(assuntos)) idsAssunto.set(`${a.disciplinaId}::${a.nome}`, a.id);
}

async function idDisciplina(nome: string) {
  const existente = idsDisciplina.get(nome);
  if (existente) return existente;
  await db.insert(disciplinas).values({ nome }).onConflictDoNothing();
  const [d] = await db.select().from(disciplinas).where(eq(disciplinas.nome, nome));
  idsDisciplina.set(nome, d!.id);
  return d!.id;
}

async function idAssunto(disciplinaId: number, nome: string | undefined) {
  if (!nome) return null;
  const chave = `${disciplinaId}::${nome}`;
  const existente = idsAssunto.get(chave);
  if (existente) return existente;
  await db.insert(assuntos).values({ disciplinaId, nome }).onConflictDoNothing();
  const [a] = await db
    .select()
    .from(assuntos)
    .where(and(eq(assuntos.disciplinaId, disciplinaId), eq(assuntos.nome, nome)));
  idsAssunto.set(chave, a!.id);
  return a!.id;
}

let loteQuestoes: LinhaQuestao[] = [];
let loteFlashcards: LinhaFlashcard[] = [];
let errosPendentes: string[] = [];

async function gravarQuestoes() {
  if (!loteQuestoes.length) return;
  const valores = [];
  for (const q of loteQuestoes) {
    const disciplinaId = await idDisciplina(q.disciplina);
    valores.push({
      codigo: q.id,
      disciplinaId,
      assuntoId: await idAssunto(disciplinaId, q.assunto),
      banca: q.banca ?? null,
      ano: q.ano ?? null,
      enunciado: q.enunciado,
      alternativas: q.alternativas,
      gabarito: q.gabarito,
      comentario: q.comentario ?? null,
    });
  }
  const inseridas = await db
    .insert(questoes)
    .values(valores)
    .onConflictDoNothing({ target: questoes.codigo })
    .returning({ id: questoes.id });
  stats.questoes += inseridas.length;
  stats.ignoradas += valores.length - inseridas.length;
  loteQuestoes = [];
}

async function gravarFlashcards() {
  if (!loteFlashcards.length) return;
  const valores = [];
  for (const f of loteFlashcards) {
    const disciplinaId = await idDisciplina(f.disciplina);
    valores.push({
      codigo: f.id,
      disciplinaId,
      assuntoId: await idAssunto(disciplinaId, f.assunto),
      frente: f.frente,
      verso: f.verso,
    });
  }
  const inseridos = await db
    .insert(flashcards)
    .values(valores)
    .onConflictDoNothing({ target: flashcards.codigo })
    .returning({ id: flashcards.id });
  stats.flashcards += inseridos.length;
  stats.ignoradas += valores.length - inseridos.length;
  loteFlashcards = [];
}

async function gravarErros() {
  if (!errosPendentes.length) return;
  await appendFile(ARQUIVO_ERROS, errosPendentes.join("\n") + "\n");
  errosPendentes = [];
}

async function main() {
  const inicio = Date.now();
  await writeFile(ARQUIVO_ERROS, "");
  await carregarCaches();
  console.log(`Importando ${ARQUIVO}...`);

  const leitor = createInterface({ input: createReadStream(ARQUIVO, "utf8"), crlfDelay: Infinity });

  for await (const bruta of leitor) {
    stats.linhas++;
    const texto = bruta.trim();
    if (!texto) continue;

    let json: unknown;
    try {
      json = JSON.parse(texto);
    } catch {
      stats.invalidas++;
      errosPendentes.push(`linha ${stats.linhas}: JSON inválido`);
      continue;
    }

    const resultado = esquemaLinha.safeParse(json);
    if (!resultado.success) {
      stats.invalidas++;
      const motivo = resultado.error.issues
        .map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`)
        .join("; ");
      errosPendentes.push(`linha ${stats.linhas}: ${motivo}`);
      continue;
    }

    if (resultado.data.tipo === "multipla") loteQuestoes.push(resultado.data);
    else loteFlashcards.push(resultado.data);

    if (loteQuestoes.length >= LOTE) await gravarQuestoes();
    if (loteFlashcards.length >= LOTE) await gravarFlashcards();
    if (errosPendentes.length >= 1000) await gravarErros();

    if (stats.linhas % 50_000 === 0) {
      const seg = (Date.now() - inicio) / 1000;
      console.log(`  ${stats.linhas.toLocaleString("pt-BR")} linhas (${Math.round(stats.linhas / seg)}/s)`);
    }
  }

  await gravarQuestoes();
  await gravarFlashcards();
  await gravarErros();

  console.log("Recalculando contagens...");
  await recontar(db);

  const seg = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`
Concluído em ${seg}s
  linhas lidas ......... ${stats.linhas.toLocaleString("pt-BR")}
  questões novas ....... ${stats.questoes.toLocaleString("pt-BR")}
  flashcards novos ..... ${stats.flashcards.toLocaleString("pt-BR")}
  já existiam .......... ${stats.ignoradas.toLocaleString("pt-BR")}
  inválidas ............ ${stats.invalidas.toLocaleString("pt-BR")}${stats.invalidas ? `  (veja ${ARQUIVO_ERROS})` : ""}`);
}

await main();
