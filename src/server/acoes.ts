"use server";

import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { createEmptyCard, fsrs, type Card, type Grade } from "ts-fsrs";
import { z } from "zod";
import { db } from "@/db";
import { suspenderPorReporte } from "@/db/aprovacao";
import { flashcards, placar, reportes, respostas, revisoesFlashcard, statusQuestao } from "@/db/schema";
import { SEGUNDOS_CHUTE } from "@/lib/patentes";
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

  // Só a primeira vez nesta questão conta no ranking (refazer não sobe), e só se não foi chute: resposta
  // a menos de SEGUNDOS_CHUTE da anterior. O tempo é medido no servidor (o cliente não informa nada).
  // Duas leituras de uma linha cada (chave primária e índice respostas_usuario_data).
  const [[jaResolvida], [anterior]] = await Promise.all([
    db
      .select({ tentativas: statusQuestao.tentativas })
      .from(statusQuestao)
      .where(and(eq(statusQuestao.usuarioId, usuario.id), eq(statusQuestao.questaoId, questao.id))),
    db
      .select({ respondidaEm: respostas.respondidaEm })
      .from(respostas)
      .where(eq(respostas.usuarioId, usuario.id))
      .orderBy(desc(respostas.respondidaEm))
      .limit(1),
  ]);
  const chute = !!anterior && agora.getTime() - anterior.respondidaEm.getTime() < SEGUNDOS_CHUTE * 1000;
  const atualizarPlacar = jaResolvida || chute
    ? []
    : [
        db
          .insert(placar)
          .values({ usuarioId: usuario.id, resolvidas: 1, acertos: correta ? 1 : 0, atualizadoEm: agora })
          .onConflictDoUpdate({
            target: placar.usuarioId,
            set: {
              resolvidas: sql`${placar.resolvidas} + 1`,
              acertos: sql`${placar.acertos} + ${correta ? 1 : 0}`,
              atualizadoEm: agora,
            },
          }),
      ];

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
    ...atualizarPlacar,
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
    .where(and(eq(flashcards.id, entrada.data.flashcardId), eq(flashcards.suspensa, false)));
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

// Reporte de erro: o item sai do ar na hora e vai para a revisão do dono (/admin/revisao).
// Limite por aluno para que ninguém tire o banco do ar reportando tudo.
const LIMITE_REPORTES_DIA = 10;
const entradaReporte = z.object({
  tipo: z.enum(["questao", "flashcard"]),
  id: z.number().int().positive(),
  motivo: z.string().trim().min(5, "Conte em poucas palavras qual é o erro.").max(1_000),
});

export type ResultadoReporte = { ok: true } | { ok: false; erro: string };

export async function reportarErro(tipo: string, id: number, motivo: string): Promise<ResultadoReporte> {
  const usuario = await exigirUsuario();
  const entrada = entradaReporte.safeParse({ tipo, id, motivo });
  if (!entrada.success) return { ok: false, erro: entrada.error.issues[0]!.message };

  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [hoje] = await db
    .select({ n: count() })
    .from(reportes)
    .where(and(eq(reportes.usuarioId, usuario.id), gte(reportes.criadoEm, desde)));
  if ((hoje?.n ?? 0) >= LIMITE_REPORTES_DIA) return { ok: false, erro: "Você já enviou muitos reportes hoje. Tente amanhã." };

  const ok = await suspenderPorReporte(db, entrada.data.tipo, entrada.data.id, usuario.id, entrada.data.motivo);
  return ok ? { ok: true } : { ok: false, erro: "Item não encontrado." };
}
