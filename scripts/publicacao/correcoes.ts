// Aplica, no local.db, as correções sugeridas pelos auditores nas questões e flashcards da fila
// (e pedidos pontuais do dono), antes da publicação. As edições são feitas por subagentes.
//
//   npx tsx scripts/publicacao/correcoes.ts preparar        cria data/publicacao/correcoes/entrada-N.json
//   npx tsx scripts/publicacao/correcoes.ts conferir <N>    confere saida-N.json (para o subagente)
//   npx tsx scripts/publicacao/correcoes.ts aplicar          grava as saídas válidas no local.db
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { z } from "zod";

const PASTA = "data/publicacao/correcoes";
const POR_ARQUIVO = 9;
const db = createClient({ url: "file:local.db" });

// Pedidos do dono que não vêm do auditor.
const PEDIDOS: Record<string, string> = {
  "piloto/inquerito-04/q10":
    'Remova do comentário (e da análise, se aparecer) o trecho sobre o STF permitir prorrogar a investigação de preso "mais de uma vez" / "novas prorrogações": ele ainda não foi confirmado na fonte oficial. Mantenha a nota de que o art. 3º-B, § 2º, é dispositivo com interpretação do STF, sem afirmar o conteúdo dessa interpretação.',
};

const texto = z.string().trim().min(1);
const esquemaQuestao = z.object({
  tipo: z.literal("questao"),
  id: z.number(),
  enunciado: texto,
  alternativas: z.array(z.object({ letra: z.string(), texto })),
  gabarito: z.string(),
  comentario: texto,
  analise_alternativas: z.array(z.object({ letra: z.string(), correta: z.boolean(), justificativa: texto })),
  fundamento_legal: z.string().nullable(),
  pegadinha: z.string().nullable(),
  destaques: z.array(z.object({ tipo: z.string(), texto })).nullable(),
  o_que_mudou: texto,
});
const esquemaFlashcard = z.object({ tipo: z.literal("flashcard"), id: z.number(), frente: texto, verso: texto, o_que_mudou: texto });
const esquemaSaida = z.object({ itens: z.array(z.union([esquemaQuestao, esquemaFlashcard])) });

async function preparar() {
  mkdirSync(PASTA, { recursive: true });
  const itens: unknown[] = [];
  const qs = await db.execute({
    sql:
      "select * from questoes_revisao where status <> 'rejeitada' and (json_extract(auditoria,'$.correcao_sugerida') is not null or json_extract(auditoria,'$.segundo.correcao_sugerida') is not null or lote in (" +
      Object.keys(PEDIDOS).map(() => "?").join(",") +
      "))",
    args: Object.keys(PEDIDOS),
  });
  for (const r of qs.rows) {
    const a = JSON.parse(String(r.auditoria));
    const correcoes = [a.correcao_sugerida, a.segundo?.correcao_sugerida].filter(Boolean);
    const pedido = PEDIDOS[String(r.lote)];
    itens.push({
      tipo: "questao",
      id: Number(r.id),
      lote: String(r.lote),
      correcoes_sugeridas: correcoes,
      ...(pedido ? { pedido_do_dono: pedido } : {}),
      atual: {
        enunciado: r.enunciado,
        alternativas: JSON.parse(String(r.alternativas)),
        gabarito: r.gabarito,
        comentario: r.comentario,
        analise_alternativas: JSON.parse(String(r.analise_alternativas)),
        fundamento_legal: r.fundamento_legal,
        pegadinha: r.pegadinha,
        destaques: r.destaques ? JSON.parse(String(r.destaques)) : null,
      },
    });
  }
  const fs = await db.execute("select * from flashcards_revisao where status <> 'rejeitada' and (json_extract(auditoria,'$.correcao_sugerida') is not null or json_extract(auditoria,'$.segundo.correcao_sugerida') is not null)");
  for (const r of fs.rows) {
    const a = JSON.parse(String(r.auditoria));
    itens.push({ tipo: "flashcard", id: Number(r.id), lote: String(r.lote), correcoes_sugeridas: [a.correcao_sugerida, a.segundo?.correcao_sugerida].filter(Boolean), atual: { frente: r.frente, verso: r.verso } });
  }
  for (let i = 0; i * POR_ARQUIVO < itens.length; i++)
    writeFileSync(`${PASTA}/entrada-${i + 1}.json`, JSON.stringify({ itens: itens.slice(i * POR_ARQUIVO, (i + 1) * POR_ARQUIVO) }, null, 2));
  console.log(`${itens.length} itens em ${Math.ceil(itens.length / POR_ARQUIVO)} arquivos (${PASTA}/entrada-N.json)`);
}

/** A correção não pode mudar o gabarito, as letras nem tirar alternativas; o tamanho da correta fica entre 80% e 125%. */
function validar(n: string) {
  const entrada = JSON.parse(readFileSync(`${PASTA}/entrada-${n}.json`, "utf8")).itens as { tipo: string; id: number; atual: { gabarito?: string; alternativas?: { letra: string }[] } }[];
  const arquivo = `${PASTA}/saida-${n}.json`;
  if (!existsSync(arquivo)) return { erros: [`${arquivo} não existe`] };
  const r = esquemaSaida.safeParse(JSON.parse(readFileSync(arquivo, "utf8")));
  if (!r.success) return { erros: r.error.issues.slice(0, 12).map((i) => `${i.path.join(".")}: ${i.message}`) };
  const erros: string[] = [];
  for (const e of entrada) {
    const s = r.data.itens.find((x) => x.tipo === e.tipo && x.id === e.id);
    if (!s) {
      erros.push(`falta o item ${e.tipo} ${e.id}`);
      continue;
    }
    if (s.tipo === "questao") {
      if (s.gabarito !== e.atual.gabarito) erros.push(`questão ${e.id}: o gabarito mudou (${e.atual.gabarito} -> ${s.gabarito})`);
      const letras = (x: { letra: string }[]) => x.map((a) => a.letra).join("");
      if (letras(s.alternativas) !== letras(e.atual.alternativas!)) erros.push(`questão ${e.id}: as letras das alternativas mudaram`);
      if (letras(s.analise_alternativas) !== letras(e.atual.alternativas!)) erros.push(`questão ${e.id}: a análise deve ter uma entrada por letra, na mesma ordem`);
      const correta = s.alternativas.find((a) => a.letra === s.gabarito)?.texto.length ?? 0;
      const outras = s.alternativas.filter((a) => a.letra !== s.gabarito).map((a) => a.texto.length);
      const razao = correta / (outras.reduce((x, y) => x + y, 0) / Math.max(outras.length, 1));
      if (razao > 1.25 || razao < 0.8) erros.push(`questão ${e.id}: a correta ficou com ${Math.round(razao * 100)}% da média das erradas (limite 80% a 125%)`);
      // Pedido do dono na inquerito-04/q10: o trecho não confirmado precisa sair.
      if ((e as { lote?: string }).lote === "piloto/inquerito-04/q10" && /mais de uma vez|novas prorroga|sucessivas prorroga/i.test(`${s.comentario} ${s.analise_alternativas.map((a) => a.justificativa).join(" ")}`))
        erros.push(`questão ${e.id}: ainda fala em prorrogação "mais de uma vez"; remova o trecho não confirmado`);
    }
  }
  return { erros, dados: r.data };
}

async function aplicar() {
  let aplicados = 0;
  for (const f of readdirSync(PASTA).filter((x) => /^entrada-\d+\.json$/.test(x))) {
    const n = f.match(/\d+/)![0];
    const { erros, dados } = validar(n);
    if (erros.length || !dados) {
      console.log(`saida-${n}.json com erros, não aplicada:\n  ${erros.join("\n  ")}`);
      process.exitCode = 1;
      continue;
    }
    for (const s of dados.itens) {
      if (s.tipo === "questao") {
        const [r] = (await db.execute({ sql: "select auditoria, status, codigo from questoes_revisao where id = ?", args: [s.id] })).rows;
        const a = JSON.parse(String(r!.auditoria));
        a.correcao_aplicada = s.o_que_mudou;
        await db.execute({
          sql: "update questoes_revisao set enunciado=?, alternativas=?, comentario=?, analise_alternativas=?, fundamento_legal=?, pegadinha=?, destaques=?, auditoria=?, motivo_revisao=? where id=?",
          args: [s.enunciado, JSON.stringify(s.alternativas), s.comentario, JSON.stringify(s.analise_alternativas), s.fundamento_legal, s.pegadinha, s.destaques ? JSON.stringify(s.destaques) : null, JSON.stringify(a), `correção do auditor aplicada: ${s.o_que_mudou}`.slice(0, 1900), s.id],
        });
        // Se já estava aprovada (e copiada para "questoes"), a cópia é atualizada também.
        if (r!.status === "aprovada") {
          const { montarComentario } = await import("../../src/lib/revisao");
          const comentario = montarComentario({
            comentario: s.comentario,
            analiseAlternativas: s.analise_alternativas,
            fundamentoLegal: s.fundamento_legal,
            fundamentoJurisprudencial: null,
            observacaoTemporal: null,
            pegadinha: s.pegadinha,
            destaques: s.destaques,
          });
          await db.execute({ sql: "update questoes set enunciado=?, alternativas=?, comentario=? where codigo=?", args: [s.enunciado, JSON.stringify(s.alternativas), comentario, String(r!.codigo)] });
        }
      } else {
        const [r] = (await db.execute({ sql: "select auditoria, status, codigo from flashcards_revisao where id = ?", args: [s.id] })).rows;
        const a = JSON.parse(String(r!.auditoria));
        a.correcao_aplicada = s.o_que_mudou;
        await db.execute({ sql: "update flashcards_revisao set frente=?, verso=?, auditoria=?, motivo_revisao=? where id=?", args: [s.frente, s.verso, JSON.stringify(a), `correção do auditor aplicada: ${s.o_que_mudou}`.slice(0, 1900), s.id] });
        if (r!.status === "aprovada") await db.execute({ sql: "update flashcards set frente=?, verso=? where codigo=?", args: [s.frente, s.verso, String(r!.codigo)] });
      }
      aplicados++;
    }
  }
  console.log(`${aplicados} correções aplicadas no local.db`);
}

const [comando, arg] = process.argv.slice(2);
if (comando === "preparar") await preparar();
else if (comando === "conferir" && arg) {
  const { erros } = validar(arg);
  console.log(erros.length ? `INVALIDO:\n  ${erros.join("\n  ")}` : "OK");
  if (erros.length) process.exitCode = 1;
} else if (comando === "aplicar") await aplicar();
else console.log("Comandos: preparar | conferir <N> | aplicar");
