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
    // 1 fácil, 2 médio, 3 difícil (src/lib/dificuldade.ts). Nulo = não classificada.
    // O aluno não escolhe o nível: serve para equilibrar o conteúdo e aparece depois da resposta.
    dificuldade: integer("dificuldade"),
    // Posição sorteada na importação: a listagem segue esta ordem para misturar níveis e áreas.
    ordem: integer("ordem").notNull().default(0),
    // Ligação com a geração por IA (aprovação em /admin/revisao). Nulos nas questões importadas por arquivo.
    // "codigo" é o mesmo de questoes_revisao.codigo: é por ele que se acha a ficha completa da revisão.
    /** "ia" para as geradas por IA e aprovadas; nulo para as importadas. */
    origem: text("origem"),
    /** Tópico de data/taxonomia.json: diz quais leis a questão usa (para revisar quando uma lei mudar). */
    topicoTaxonomia: text("topico_taxonomia"),
    subtopico: text("subtopico"),
    /** Dispositivo citado (ex.: "CPP, art. 14"). */
    leiReferencia: text("lei_referencia"),
    /** Fora do ar (um aluno reportou erro): não aparece nas listas nem nas contagens até ser revisada. */
    suspensa: integer("suspensa", { mode: "boolean" }).notNull().default(false),
    /**
     * Impressão da pergunta (o enunciado, sem acento, pontuação nem caixa, em qualquer matéria). Na importação, uma
     * questão com a mesma chave e a alternativa correta parecida é a mesma pergunta reescrita e não entra
     * (chaveEnunciado e mesmaResposta em src/db/importacao.ts).
     */
    chaveEnunciado: text("chave_enunciado"),
  },
  (t) => [
    index("questoes_chave_enunciado").on(t.chaveEnunciado),
    // Achar as questões de IA de um tópico (ex.: lei alterada). Fora do caminho do aluno.
    index("questoes_origem_topico").on(t.origem, t.topicoTaxonomia),
    // O SQLite acrescenta o id (rowid) no fim de todo índice: (ordem, id) fica coberto para o cursor.
    index("questoes_ordem").on(t.ordem),
    index("questoes_disciplina_ordem").on(t.disciplinaId, t.ordem),
    index("questoes_assunto_ordem").on(t.assuntoId, t.ordem),
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
    // Mesma ligação das questões com a geração por IA (codigo = flashcards_revisao.codigo).
    origem: text("origem"),
    topicoTaxonomia: text("topico_taxonomia"),
    leiReferencia: text("lei_referencia"),
    /** Fora do ar por reporte de erro de aluno. */
    suspensa: integer("suspensa", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("flashcards_disciplina_id").on(t.disciplinaId, t.id),
    index("flashcards_assunto_id").on(t.assuntoId, t.id),
  ],
);

// Totais pré-calculados. Nunca faça COUNT(*) sobre "questoes" numa requisição:
// no Turso cada linha contada entra na cota de linhas lidas.
// Chaves: "q:total", "q:d:<disciplinaId>", "q:a:<assuntoId>", "f:total", "f:d:<disciplinaId>", "f:a:<assuntoId>".
export const contagens = sqliteTable("contagens", {
  chave: text("chave").primaryKey(),
  total: integer("total").notNull(),
});
