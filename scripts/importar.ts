// Importa questões e flashcards de um arquivo (.jsonl, .json do prompt de IA, ou array JSON).
// Uso: npm run importar -- caminho/do/arquivo.jsonl
//      npm run importar -- caminho/do/arquivo.jsonl --verificar   (só valida, não grava nada)
//
// Pode rodar quantas vezes quiser: itens com "id" já importado são ignorados (não duplica, não sobrescreve).
// Sem "id", o código é uma impressão digital do conteúdo: a mesma questão vinda de outro arquivo é ignorada.
// Disciplina e assunto precisam existir em data/catalogo.json (o mapa oficial de matérias e áreas).
// Linhas inválidas vão para data/erros-importacao.log com o número da linha e o motivo.
// As regras ficam em src/db/importacao.ts (as mesmas da tela do dono em /admin).
import "./_env";
import { createReadStream } from "node:fs";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { db } from "../src/db";
import { criarGravador, lerArquivo, prepararItem, type FlashcardPronto, type QuestaoPronta } from "../src/db/importacao";
import { recontar } from "./lib/recontar";

const argumentos = process.argv.slice(2);
const SO_VERIFICAR = argumentos.includes("--verificar");
const ARQUIVO = argumentos.find((a) => !a.startsWith("--")) ?? "data/exemplo.jsonl";
const ARQUIVO_ERROS = "data/erros-importacao.log";
// 500 linhas por INSERT: poucas idas ao banco e bem abaixo do limite de variáveis do SQLite.
const LOTE = 500;

const stats = { linhas: 0, invalidas: 0, questoes: 0, flashcards: 0, ignoradas: 0 };
const gravador = criarGravador(db);

let loteQuestoes: QuestaoPronta[] = [];
let loteFlashcards: FlashcardPronto[] = [];
let errosPendentes: string[] = [];

async function gravarQuestoes() {
  if (!loteQuestoes.length) return;
  const novas = SO_VERIFICAR ? loteQuestoes.length : await gravador.gravarQuestoes(loteQuestoes);
  stats.questoes += novas;
  stats.ignoradas += loteQuestoes.length - novas;
  loteQuestoes = [];
}

async function gravarFlashcards() {
  if (!loteFlashcards.length) return;
  const novos = SO_VERIFICAR ? loteFlashcards.length : await gravador.gravarFlashcards(loteFlashcards);
  stats.flashcards += novos;
  stats.ignoradas += loteFlashcards.length - novos;
  loteFlashcards = [];
}

async function gravarErros() {
  if (!errosPendentes.length) return;
  await appendFile(ARQUIVO_ERROS, errosPendentes.join("\n") + "\n");
  errosPendentes = [];
}

async function processar(bruto: unknown, rotulo: string) {
  const r = prepararItem(bruto);
  if (!r.ok) {
    stats.invalidas++;
    errosPendentes.push(`${rotulo}: ${r.erro}`);
    return;
  }
  if (r.item.tipo === "multipla") loteQuestoes.push(r.item);
  else loteFlashcards.push(r.item);
  if (loteQuestoes.length >= LOTE) await gravarQuestoes();
  if (loteFlashcards.length >= LOTE) await gravarFlashcards();
  if (errosPendentes.length >= 1000) await gravarErros();
}

async function main() {
  const inicio = Date.now();
  await writeFile(ARQUIVO_ERROS, "");
  console.log(SO_VERIFICAR ? `Verificando ${ARQUIVO} (nada será gravado)...` : `Importando ${ARQUIVO}...`);

  if (ARQUIVO.endsWith(".jsonl")) {
    // JSON Lines em streaming: aguenta arquivos de 1 milhão de linhas sem carregar tudo na memória.
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
      await processar(json, `linha ${stats.linhas}`);
      if (stats.linhas % 50_000 === 0) {
        const seg = (Date.now() - inicio) / 1000;
        console.log(`  ${stats.linhas.toLocaleString("pt-BR")} linhas (${Math.round(stats.linhas / seg)}/s)`);
      }
    }
  } else {
    // .json (formato do prompt de IA ou array): arquivos pequenos, lidos inteiros.
    const { itens, erro } = lerArquivo(await readFile(ARQUIVO, "utf8"));
    if (erro) throw new Error(erro);
    for (const [i, item] of itens.entries()) {
      stats.linhas++;
      await processar(item, `item ${i + 1}`);
    }
  }

  await gravarQuestoes();
  await gravarFlashcards();
  await gravarErros();

  if (!SO_VERIFICAR) {
    // As contagens já foram somadas a cada lote; a recontagem completa corrige qualquer desvio.
    console.log("Recalculando contagens...");
    await recontar(db);
  }

  const seg = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`
Concluído em ${seg}s
  itens lidos .......... ${stats.linhas.toLocaleString("pt-BR")}
  questões ${SO_VERIFICAR ? "válidas ...." : "novas ......"} ${stats.questoes.toLocaleString("pt-BR")}
  flashcards ${SO_VERIFICAR ? "válidos .." : "novos ...."} ${stats.flashcards.toLocaleString("pt-BR")}
  já existiam .......... ${stats.ignoradas.toLocaleString("pt-BR")}
  inválidas ............ ${stats.invalidas.toLocaleString("pt-BR")}${stats.invalidas ? `  (veja ${ARQUIVO_ERROS})` : ""}`);
}

await main();
