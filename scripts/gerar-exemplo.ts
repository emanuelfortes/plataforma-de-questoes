// Gera um .jsonl de exemplo no formato oficial (docs/FORMATO-QUESTOES.md).
// Uso:
//   npm run exemplo                                         -> 1.000 questões + 200 flashcards em data/exemplo.jsonl
//   npm run exemplo -- --questoes 1000000 --saida data/carga.jsonl   -> teste de carga com 1 milhão
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    questoes: { type: "string", default: "1000" },
    flashcards: { type: "string", default: "200" },
    saida: { type: "string", default: "data/exemplo.jsonl" },
    semente: { type: "string", default: "42" },
  },
});

const TOTAL_Q = Number(values.questoes);
const TOTAL_F = Number(values.flashcards);

// Gerador pseudoaleatório com semente: o mesmo comando sempre gera o mesmo arquivo.
let estado = Number(values.semente) >>> 0;
function aleatorio() {
  estado = (estado + 0x6d2b79f5) >>> 0;
  let t = estado;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const escolher = <T>(lista: readonly T[]) => lista[Math.floor(aleatorio() * lista.length)]!;

const DISCIPLINAS = {
  "Língua Portuguesa": ["Crase", "Concordância Verbal", "Regência", "Pontuação", "Interpretação de Texto"],
  "Direito Constitucional": ["Direitos Fundamentais", "Organização do Estado", "Poder Legislativo", "Controle de Constitucionalidade"],
  "Direito Administrativo": ["Atos Administrativos", "Licitações e Contratos", "Agentes Públicos", "Improbidade Administrativa"],
  Matemática: ["Porcentagem", "Razão e Proporção", "Equações do 1º Grau", "Probabilidade"],
  "Raciocínio Lógico": ["Proposições", "Sequências", "Lógica de Argumentação"],
  Informática: ["Redes de Computadores", "Segurança da Informação", "Planilhas", "Sistemas Operacionais"],
} as const;
const NOMES = Object.keys(DISCIPLINAS) as (keyof typeof DISCIPLINAS)[];
const BANCAS = ["CEBRASPE", "FGV", "FCC", "VUNESP", "CESGRANRIO"] as const;
const LETRAS = ["A", "B", "C", "D", "E"] as const;

function questao(n: number) {
  const disciplina = escolher(NOMES);
  const assunto = escolher(DISCIPLINAS[disciplina]);
  const banca = escolher(BANCAS);
  const ano = 2015 + Math.floor(aleatorio() * 11);
  const id = `q_${String(n).padStart(7, "0")}`;

  // A CEBRASPE usa o formato Certo/Errado: modelado como 2 alternativas.
  if (banca === "CEBRASPE") {
    const gabarito = aleatorio() < 0.5 ? "C" : "E";
    return {
      tipo: "multipla",
      id,
      disciplina,
      assunto,
      banca,
      ano,
      enunciado: `(Exemplo ${n}) Julgue o item a seguir, relativo a ${assunto.toLowerCase()}.\n\nAfirmação de exemplo sobre ${assunto} em ${disciplina}, gerada para testar a plataforma.`,
      alternativas: [
        { letra: "C", texto: "Certo" },
        { letra: "E", texto: "Errado" },
      ],
      gabarito,
      comentario: `Comentário de exemplo: o item está ${gabarito === "C" ? "certo" : "errado"}.`,
    };
  }

  const gabarito = escolher(LETRAS);
  return {
    tipo: "multipla",
    id,
    disciplina,
    assunto,
    banca,
    ano,
    enunciado: `(Exemplo ${n}) Sobre ${assunto.toLowerCase()} em ${disciplina}, assinale a alternativa correta.`,
    alternativas: LETRAS.map((letra) => ({
      letra,
      texto: `Afirmativa ${letra} sobre ${assunto}${letra === gabarito ? " (esta é a correta no exemplo)" : ""}.`,
    })),
    gabarito,
    comentario: `Comentário de exemplo: a alternativa ${gabarito} é a correta.`,
  };
}

function flashcard(n: number) {
  const disciplina = escolher(NOMES);
  const assunto = escolher(DISCIPLINAS[disciplina]);
  return {
    tipo: "flashcard",
    id: `f_${String(n).padStart(7, "0")}`,
    disciplina,
    assunto,
    frente: `(Exemplo ${n}) Qual o conceito central de ${assunto} em ${disciplina}?`,
    verso: `Resposta de exemplo para ${assunto}. Substitua pelo conteúdo real na importação.`,
  };
}

const saida = createWriteStream(values.saida!, { encoding: "utf8" });
async function escrever(obj: unknown) {
  if (!saida.write(JSON.stringify(obj) + "\n")) await once(saida, "drain");
}

const inicio = Date.now();
for (let i = 1; i <= TOTAL_Q; i++) {
  await escrever(questao(i));
  if (i % 100_000 === 0) console.log(`  ${i.toLocaleString("pt-BR")} questões...`);
}
for (let i = 1; i <= TOTAL_F; i++) await escrever(flashcard(i));
saida.end();
await once(saida, "finish");

console.log(
  `Gerado ${values.saida}: ${TOTAL_Q.toLocaleString("pt-BR")} questões e ` +
    `${TOTAL_F.toLocaleString("pt-BR")} flashcards em ${((Date.now() - inicio) / 1000).toFixed(1)}s.`,
);
