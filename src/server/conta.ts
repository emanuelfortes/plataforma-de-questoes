import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  assinaturas,
  monitores,
  pagamentos,
  placar,
  questoes,
  reportes,
  respostas,
  revisoesFlashcard,
  session,
  simuladoTentativas,
  simulados,
  statusQuestao,
  user,
} from "@/db/schema";

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

/** Tudo que guardamos sobre o aluno, para a exportação da LGPD. Senha e cartão nunca ficam aqui. */
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

  const [historico, status, revisoes, listaAssinaturas, simuladosFeitos, [ranking], reportados, acessos, [monitor]] =
    await Promise.all([
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
      db.select().from(revisoesFlashcard).where(eq(revisoesFlashcard.usuarioId, usuarioId)),
      db
        .select({
          id: assinaturas.id,
          status: assinaturas.status,
          valorCentavos: assinaturas.valorCentavos,
          acessoAte: assinaturas.acessoAte,
          criadaEm: assinaturas.criadaEm,
          atualizadaEm: assinaturas.atualizadaEm,
        })
        .from(assinaturas)
        .where(eq(assinaturas.usuarioId, usuarioId))
        .orderBy(assinaturas.criadaEm),
      db
        .select({
          simulado: simulados.titulo,
          concurso: simulados.concurso,
          iniciadoEm: simuladoTentativas.iniciadoEm,
          entregueEm: simuladoTentativas.entregueEm,
          marcacoes: simuladoTentativas.respostas,
          acertos: simuladoTentativas.acertos,
          tempoSeg: simuladoTentativas.tempoSeg,
        })
        .from(simuladoTentativas)
        .innerJoin(simulados, eq(simulados.id, simuladoTentativas.simuladoId))
        .where(eq(simuladoTentativas.usuarioId, usuarioId)),
      db
        .select({
          resolvidas: placar.resolvidas,
          acertosDePrimeira: placar.acertos,
          sequencia: placar.sequencia,
          maiorSequencia: placar.maiorSequencia,
          atualizadoEm: placar.atualizadoEm,
        })
        .from(placar)
        .where(eq(placar.usuarioId, usuarioId)),
      db
        .select({
          tipo: reportes.tipo,
          itemId: reportes.itemId,
          motivo: reportes.motivo,
          situacao: reportes.situacao,
          criadoEm: reportes.criadoEm,
          resolvidoEm: reportes.resolvidoEm,
        })
        .from(reportes)
        .where(eq(reportes.usuarioId, usuarioId)),
      // Sessões de login: sem o token (é a chave de acesso à conta).
      db
        .select({
          criadaEm: session.createdAt,
          expiraEm: session.expiresAt,
          ip: session.ipAddress,
          navegador: session.userAgent,
        })
        .from(session)
        .where(eq(session.userId, usuarioId)),
      db.select({ desde: monitores.criadoEm }).from(monitores).where(eq(monitores.usuarioId, usuarioId)),
    ]);

  // Cobranças pela assinatura (o índice é por assinatura, não por aluno).
  const cobrancas = listaAssinaturas.length
    ? await db
        .select({
          id: pagamentos.id,
          assinatura: pagamentos.assinaturaId,
          valorCentavos: pagamentos.valorCentavos,
          status: pagamentos.status,
          cobradoEm: pagamentos.cobradoEm,
        })
        .from(pagamentos)
        .where(inArray(pagamentos.assinaturaId, listaAssinaturas.map((a) => a.id)))
        .orderBy(pagamentos.cobradoEm)
    : [];

  return {
    exportadoEm: new Date(),
    perfil: { ...perfil, monitorDesde: monitor?.desde ?? null },
    assinaturas: listaAssinaturas.map((a) => ({ ...a, forma: a.id.startsWith("pix:") ? "pix" : "cartao" })),
    pagamentos: cobrancas,
    respostas: historico,
    statusQuestoes: status,
    revisoesFlashcards: revisoes.map(({ usuarioId: _, ...r }) => r),
    simulados: simuladosFeitos,
    ranking: ranking ?? null,
    errosReportados: reportados,
    acessos,
  };
}
