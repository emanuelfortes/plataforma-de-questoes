import "server-only";
import { and, asc, eq, isNull, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { assuntos, disciplinas, flashcards, revisoesFlashcard } from "@/db/schema";
import { filtroAreas } from "@/server/questoes";

export const LIMITE_SESSAO = 20;
export const NOVOS_POR_SESSAO = 10;

/**
 * Monta uma sessão: primeiro os cards vencidos (revisão), depois cards nunca vistos (novos).
 */
export async function montarSessao(usuarioId: string, disciplinaId?: number, assuntoIds?: number[]) {
  const agora = new Date();
  const filtroDisciplina: SQL[] = [];
  if (disciplinaId) filtroDisciplina.push(eq(flashcards.disciplinaId, disciplinaId));
  // Várias áreas: percorre o índice (disciplina, id) já ordenado (ver filtroAreas).
  const areas = filtroAreas(flashcards.assuntoId, assuntoIds);
  if (areas) filtroDisciplina.push(areas);

  const campos = {
    id: flashcards.id,
    frente: flashcards.frente,
    verso: flashcards.verso,
    disciplina: disciplinas.nome,
    assunto: assuntos.nome,
  };

  const vencidos = await db
    .select(campos)
    .from(revisoesFlashcard)
    .innerJoin(flashcards, eq(flashcards.id, revisoesFlashcard.flashcardId))
    .innerJoin(disciplinas, eq(disciplinas.id, flashcards.disciplinaId))
    .leftJoin(assuntos, eq(assuntos.id, flashcards.assuntoId))
    .where(
      and(
        eq(revisoesFlashcard.usuarioId, usuarioId),
        lte(revisoesFlashcard.vence, agora),
        ...filtroDisciplina,
      ),
    )
    .orderBy(asc(revisoesFlashcard.vence))
    .limit(LIMITE_SESSAO);

  const vagas = Math.min(NOVOS_POR_SESSAO, LIMITE_SESSAO - vencidos.length);
  const novos =
    vagas > 0
      ? await db
          .select(campos)
          .from(flashcards)
          .innerJoin(disciplinas, eq(disciplinas.id, flashcards.disciplinaId))
          .leftJoin(assuntos, eq(assuntos.id, flashcards.assuntoId))
          .leftJoin(
            revisoesFlashcard,
            and(
              eq(revisoesFlashcard.flashcardId, flashcards.id),
              eq(revisoesFlashcard.usuarioId, usuarioId),
            ),
          )
          .where(and(isNull(revisoesFlashcard.flashcardId), ...filtroDisciplina))
          .orderBy(asc(flashcards.id))
          .limit(vagas)
      : [];

  return [
    ...vencidos.map((c) => ({ ...c, tipo: "revisao" as const })),
    ...novos.map((c) => ({ ...c, tipo: "novo" as const })),
  ];
}

export type CardSessao = Awaited<ReturnType<typeof montarSessao>>[number];
