import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { questoes, respostas, revisoesFlashcard, statusQuestao, user, placar } from "@/db/schema";

/**
 * Apaga o histórico de estudo do aluno. Chamado antes de excluir a conta.
 * As FKs têm onDelete cascade, mas no SQLite isso depende de PRAGMA foreign_keys estar ligado
 * na conexão. A limpeza explícita garante a remoção (LGPD) em qualquer caso.
 */
export async function apagarDadosDeEstudo(usuarioId: string) {
  await db.batch([
    db.delete(respostas).where(eq(respostas.usuarioId, usuarioId)),
    db.delete(statusQuestao).where(eq(statusQuestao.usuarioId, usuarioId)),
    db.delete(revisoesFlashcard).where(eq(revisoesFlashcard.usuarioId, usuarioId)),
    db.delete(placar).where(eq(placar.usuarioId, usuarioId)),
  ]);
}

/** Tudo que guardamos sobre o aluno, para a exportação da LGPD. */
export async function exportarDados(usuarioId: string) {
  const [perfil] = await db
    .select({
      nome: user.name,
      email: user.email,
      emailConfirmado: user.emailVerified,
      criadoEm: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, usuarioId));

  const [historico, status, revisoes] = await Promise.all([
    db
      .select({
        questao: questoes.codigo,
        alternativa: respostas.alternativa,
        correta: respostas.correta,
        respondidaEm: respostas.respondidaEm,
      })
      .from(respostas)
      .innerJoin(questoes, eq(questoes.id, respostas.questaoId))
      .where(eq(respostas.usuarioId, usuarioId))
      .orderBy(respostas.respondidaEm),
    db
      .select({
        questao: questoes.codigo,
        ultimaCorreta: statusQuestao.ultimaCorreta,
        tentativas: statusQuestao.tentativas,
        atualizadaEm: statusQuestao.atualizadaEm,
      })
      .from(statusQuestao)
      .innerJoin(questoes, eq(questoes.id, statusQuestao.questaoId))
      .where(eq(statusQuestao.usuarioId, usuarioId)),
    db
      .select()
      .from(revisoesFlashcard)
      .where(eq(revisoesFlashcard.usuarioId, usuarioId)),
  ]);

  return {
    exportadoEm: new Date(),
    perfil,
    respostas: historico,
    statusQuestoes: status,
    revisoesFlashcards: revisoes.map(({ usuarioId: _, ...r }) => r),
  };
}
