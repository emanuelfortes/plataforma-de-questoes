// Dados gerados pelo aluno enquanto estuda.
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { flashcards, questoes } from "./conteudo";

// Histórico completo: uma linha por tentativa. Fonte do desempenho (hoje, ontem, 7, 15, 30 dias).
export const respostas = sqliteTable(
  "respostas",
  {
    id: integer("id").primaryKey(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    questaoId: integer("questao_id")
      .notNull()
      .references(() => questoes.id),
    alternativa: text("alternativa").notNull(),
    correta: integer("correta", { mode: "boolean" }).notNull(),
    // Sempre em UTC (segundos). O fuso do Brasil é aplicado só na hora de agrupar por dia.
    respondidaEm: integer("respondida_em", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("respostas_usuario_data").on(t.usuarioId, t.respondidaEm)],
);

// Último estado de cada questão por aluno. Fonte dos filtros/ícones:
// sem linha = não resolvida | linha existe = resolvida | ultimaCorreta = acertou/errou.
export const statusQuestao = sqliteTable(
  "status_questao",
  {
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    questaoId: integer("questao_id")
      .notNull()
      .references(() => questoes.id),
    ultimaCorreta: integer("ultima_correta", { mode: "boolean" }).notNull(),
    tentativas: integer("tentativas").notNull().default(1),
    atualizadaEm: integer("atualizada_em", { mode: "timestamp" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.questaoId] })],
);

// Estado da repetição espaçada (FSRS, via ts-fsrs) de cada flashcard por aluno.
export const revisoesFlashcard = sqliteTable(
  "revisoes_flashcard",
  {
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    flashcardId: integer("flashcard_id")
      .notNull()
      .references(() => flashcards.id),
    vence: integer("vence", { mode: "timestamp" }).notNull(),
    estabilidade: real("estabilidade").notNull(),
    dificuldade: real("dificuldade").notNull(),
    diasDecorridos: integer("dias_decorridos").notNull(),
    diasAgendados: integer("dias_agendados").notNull(),
    passosAprendizado: integer("passos_aprendizado").notNull().default(0),
    repeticoes: integer("repeticoes").notNull(),
    lapsos: integer("lapsos").notNull(),
    estado: integer("estado").notNull(),
    ultimaRevisao: integer("ultima_revisao", { mode: "timestamp" }),
  },
  (t) => [
    primaryKey({ columns: [t.usuarioId, t.flashcardId] }),
    index("revisoes_usuario_vence").on(t.usuarioId, t.vence),
  ],
);
