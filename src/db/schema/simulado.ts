// Simulados do plano Elite: o professor sobe o PDF (o aluno baixa e imprime), o gabarito oficial e o tempo
// de prova. Na plataforma o aluno só marca o gabarito com o cronômetro correndo; o ranking sai das entregas.
import { blob, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const simulados = sqliteTable(
  "simulados",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    titulo: text("titulo").notNull(),
    /** Um de CONCURSOS_SIMULADO (src/lib/planos.ts). */
    concurso: text("concurso").notNull(),
    /** "ABCD", "ABCDE" ou "CE" (certo ou errado): as opções de cada questão no gabarito. */
    opcoes: text("opcoes").notNull(),
    /** Gabarito oficial, uma letra por questão ("X" = anulada: conta ponto para todos). */
    gabarito: text("gabarito", { mode: "json" }).$type<string[]>().notNull(),
    duracaoMin: integer("duracao_min").notNull(),
    /** O aluno vê e pode fazer a partir daqui. */
    liberadoEm: integer("liberado_em", { mode: "timestamp" }).notNull(),
    /** Depois daqui não dá mais para começar (o ranking fica). Nulo = sem prazo. */
    encerraEm: integer("encerra_em", { mode: "timestamp" }),
    arquivoNome: text("arquivo_nome"),
    arquivoBytes: integer("arquivo_bytes"),
    /** Partes do PDF já gravadas; o arquivo está completo quando partes = partesTotal. */
    partesTotal: integer("partes_total").notNull().default(0),
    criadoEm: integer("criado_em", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("simulados_liberado").on(t.liberadoEm)],
);

/** O PDF em pedaços (o envio pela Vercel tem limite de tamanho por requisição). */
export const simuladoArquivo = sqliteTable(
  "simulado_arquivo",
  {
    simuladoId: integer("simulado_id")
      .notNull()
      .references(() => simulados.id, { onDelete: "cascade" }),
    parte: integer("parte").notNull(),
    dados: blob("dados", { mode: "buffer" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.simuladoId, t.parte] })],
);

/** Uma tentativa por aluno e simulado: começa no play e termina na entrega (ou quando o tempo acaba). */
export const simuladoTentativas = sqliteTable(
  "simulado_tentativas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    simuladoId: integer("simulado_id")
      .notNull()
      .references(() => simulados.id, { onDelete: "cascade" }),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    iniciadoEm: integer("iniciado_em", { mode: "timestamp" }).notNull(),
    /** Marcações do aluno, uma por questão ("" = em branco). Salvas enquanto ele marca. */
    respostas: text("respostas", { mode: "json" }).$type<string[]>().notNull(),
    entregueEm: integer("entregue_em", { mode: "timestamp" }),
    acertos: integer("acertos"),
    /** Segundos entre o play e a entrega (desempate do ranking: menos tempo fica na frente). */
    tempoSeg: integer("tempo_seg"),
  },
  (t) => [
    uniqueIndex("simulado_tentativas_aluno").on(t.simuladoId, t.usuarioId),
    index("simulado_tentativas_ranking").on(t.simuladoId, t.acertos, t.tempoSeg),
  ],
);
