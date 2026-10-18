"use server";

import { and, eq, sql } from "drizzle-orm";
import { createEmptyCard, fsrs, type Card, type Grade } from "ts-fsrs";
import { z } from "zod";
import { db } from "@/db";
import { flashcards, respostas, revisoesFlashcard, statusQuestao } from "@/db/schema";
import { LIMITE_GRATIS_DIA } from "@/lib/planos";
import { exigirUsuario } from "@/lib/sessao";
import { situacaoDoAluno } from "./assinatura";
import { obterGabarito } from "./questoes";

const entradaResposta = z.object({
  questaoId: z.number().int().positive(),
  alternativa: z.string().regex(/^[A-Z]$/),
});

export type ResultadoResposta =
  | { ok: true; correta: boolean; gabarito: string; comentario: string | null }
  | { ok: false; erro: string; limite?: boolean };

/** Registra a tentativa no histórico e atualiza o último estado da questão para o aluno. */
export async function responderQuestao(
  questaoId: number,
  alternativa: string,
): Promise<ResultadoResposta> {
  const usuario = await exigirUsuario();
  const entrada = entradaResposta.safeParse({ questaoId, alternativa });
  if (!entrada.success) return { ok: false, erro: "Resposta inválida." };

  // Quem não assina tem um limite de questões por dia (o dono não tem limite).
  const situacao = await situacaoDoAluno(usuario);
  if (!situacao.assinante && situacao.respondidasHoje >= LIMITE_GRATIS_DIA) {
    return {
      ok: false,
      limite: true,
      erro: `Você usou as ${LIMITE_GRATIS_DIA} questões grátis de hoje. Assine para continuar sem limite.`,
    };
  }

  const questao = await obterGabarito(entrada.data.questaoId);
  if (!questao) return { ok: false, erro: "Questão não encontrada." };
  if (!questao.letras.some((a) => a.letra === entrada.data.alternativa)) {
    return { ok: false, erro: "Alternativa inexistente." };
  }

  const correta = questao.gabarito === entrada.data.alternativa;
  const agora = new Date();

  // batch = uma ida ao banco e atômico no libSQL.
  await db.batch([
    db.insert(respostas).values({
      usuarioId: usuario.id,
      questaoId: questao.id,
      alternativa: entrada.data.alternativa,
      correta,
      respondidaEm: agora,
    }),
    db
      .insert(statusQuestao)
      .values({
        usuarioId: usuario.id,
        questaoId: questao.id,
        ultimaCorreta: correta,
        tentativas: 1,
        atualizadaEm: agora,
      })
      .onConflictDoUpdate({
        target: [statusQuestao.usuarioId, statusQuestao.questaoId],
        set: {
          ultimaCorreta: correta,
          tentativas: sql`${statusQuestao.tentativas} + 1`,
          atualizadaEm: agora,
        },
      }),
  ]);

  return { ok: true, correta, gabarito: questao.gabarito, comentario: questao.comentario };
}

const agendador = fsrs({ enable_fuzz: true });

const entradaAvaliacao = z.object({
  flashcardId: z.number().int().positive(),
  // 1 = Errei, 2 = Difícil, 3 = Bom, 4 = Fácil (escala do Anki/FSRS)
  nota: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export type ResultadoAvaliacao = { ok: true; proximaRevisao: string } | { ok: false; erro: string };

/** Aplica o FSRS e grava quando o card deve voltar para este aluno. */
export async function avaliarFlashcard(
  flashcardId: number,
  nota: number,
): Promise<ResultadoAvaliacao> {
  const usuario = await exigirUsuario();
  const entrada = entradaAvaliacao.safeParse({ flashcardId, nota });
  if (!entrada.success) return { ok: false, erro: "Avaliação inválida." };

  const [existe] = await db
    .select({ id: flashcards.id })
    .from(flashcards)
    .where(eq(flashcards.id, entrada.data.flashcardId));
  if (!existe) return { ok: false, erro: "Flashcard não encontrado." };

  const [anterior] = await db
    .select()
    .from(revisoesFlashcard)
    .where(
      and(
        eq(revisoesFlashcard.usuarioId, usuario.id),
        eq(revisoesFlashcard.flashcardId, entrada.data.flashcardId),
      ),
    );

  const agora = new Date();
  const cardAtual: Card = anterior
    ? {
        due: anterior.vence,
        stability: anterior.estabilidade,
        difficulty: anterior.dificuldade,
        elapsed_days: anterior.diasDecorridos,
        scheduled_days: anterior.diasAgendados,
        learning_steps: anterior.passosAprendizado,
        reps: anterior.repeticoes,
        lapses: anterior.lapsos,
        state: anterior.estado,
        last_review: anterior.ultimaRevisao ?? undefined,
      }
    : createEmptyCard(agora);

  const { card } = agendador.next(cardAtual, agora, entrada.data.nota as Grade);

  const valores = {
    vence: card.due,
    estabilidade: card.stability,
    dificuldade: card.difficulty,
    diasDecorridos: card.elapsed_days,
    diasAgendados: card.scheduled_days,
    passosAprendizado: card.learning_steps,
    repeticoes: card.reps,
    lapsos: card.lapses,
    estado: card.state,
    ultimaRevisao: card.last_review ?? agora,
  };

  await db
    .insert(revisoesFlashcard)
    .values({ usuarioId: usuario.id, flashcardId: entrada.data.flashcardId, ...valores })
    .onConflictDoUpdate({
      target: [revisoesFlashcard.usuarioId, revisoesFlashcard.flashcardId],
      set: valores,
    });

  return { ok: true, proximaRevisao: card.due.toISOString() };
}
