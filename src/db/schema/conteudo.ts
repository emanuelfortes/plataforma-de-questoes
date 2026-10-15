// Conteúdo do banco de questões. Muda só na importação, nunca por ação do aluno.
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export type Alternativa = { letra: string; texto: string };

export const disciplinas = sqliteTable("disciplinas", {
  id: integer("id").primaryKey(),
  nome: text("nome").notNull().unique(),
});

export const assuntos = sqliteTable(
  "assuntos",
  {
    id: integer("id").primaryKey(),
    disciplinaId: integer("disciplina_id")
      .notNull()
      .references(() => disciplinas.id),
    nome: text("nome").notNull(),
  },
  (t) => [uniqueIndex("assuntos_disciplina_nome").on(t.disciplinaId, t.nome)],
);

export const questoes = sqliteTable(
  "questoes",
  {
    // INTEGER PRIMARY KEY no SQLite é o próprio rowid: a ordem por id é a ordem física, ótima para paginar por cursor.
    id: integer("id").primaryKey(),
    // Identificador vindo do JSONL. Garante que reimportar não duplica.
    codigo: text("codigo").notNull().unique(),
    disciplinaId: integer("disciplina_id")
      .notNull()
      .references(() => disciplinas.id),
    assuntoId: integer("assunto_id").references(() => assuntos.id),
    banca: text("banca"),
    ano: integer("ano"),
    enunciado: text("enunciado").notNull(),
    // Alternativas ficam em JSON na própria linha: 1 escrita por questão na importação (cota de escritas do Turso).
    alternativas: text("alternativas", { mode: "json" }).$type<Alternativa[]>().notNull(),
    gabarito: text("gabarito").notNull(),
    comentario: text("comentario"),
  },
  (t) => [
    index("questoes_disciplina_id").on(t.disciplinaId, t.id),
    index("questoes_assunto_id").on(t.assuntoId, t.id),
  ],
);

export const flashcards = sqliteTable(
  "flashcards",
  {
    id: integer("id").primaryKey(),
    codigo: text("codigo").notNull().unique(),
    disciplinaId: integer("disciplina_id")
      .notNull()
      .references(() => disciplinas.id),
    assuntoId: integer("assunto_id").references(() => assuntos.id),
    frente: text("frente").notNull(),
    verso: text("verso").notNull(),
  },
  (t) => [index("flashcards_disciplina_id").on(t.disciplinaId, t.id)],
);

// Totais pré-calculados. Nunca faça COUNT(*) sobre "questoes" numa requisição:
// no Turso cada linha contada entra na cota de linhas lidas.
// Chaves: "q:total", "q:d:<disciplinaId>", "q:a:<assuntoId>", "f:total", "f:d:<disciplinaId>".
export const contagens = sqliteTable("contagens", {
  chave: text("chave").primaryKey(),
  total: integer("total").notNull(),
});
