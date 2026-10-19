// Questões geradas por IA aguardando revisão humana. Ficam fora de "questoes" (e longe dos alunos,
// dos índices e das contagens) até serem aprovadas; a aprovação copia para "questoes".
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Alternativa } from "./conteudo";

export type AnaliseAlternativa = { letra: string; correta: boolean; justificativa: string };
export type ResultadoAuditoria = {
  justificativa: string;
  problemas: { tipo: string; gravidade: string; descricao: string }[];
  correcao_sugerida: string | null;
  gabarito_confere: boolean;
  mais_de_uma_correta: boolean;
  ambiguidade: boolean;
  fundamento_confere: boolean;
  citacoes_jurisprudencia: string[];
  regenerada: boolean;
  /** Reprocessamento depois da auditoria (tamanho das alternativas, nota obrigatória, revisão do professor). */
  ajuste?: { motivos: string[]; reprovado: string | null };
  /** Checagens em código que rebaixaram a questão (dispositivo sem nota, trecho de nota a confirmar). */
  alertas?: string[];
};

export const questoesRevisao = sqliteTable(
  "questoes_revisao",
  {
    id: integer("id").primaryKey(),
    // Impressão digital do conteúdo (a mesma de questoes.codigo): reimportar não duplica.
    codigo: text("codigo").notNull().unique(),
    /** pendente_revisao | aprovada | rejeitada (decisão humana). */
    status: text("status").notNull().default("pendente_revisao"),
    /** ia | manual | prova. */
    origem: text("origem").notNull().default("ia"),
    /** VALIDADA | VALIDADA_COM_RESSALVA | NECESSITA_DE_CONFERENCIA (veredito do auditor). */
    statusAuditoria: text("status_auditoria").notNull(),
    disciplina: text("disciplina").notNull(),
    assunto: text("assunto").notNull(),
    subtopico: text("subtopico"),
    topicoTaxonomia: text("topico_taxonomia").notNull(),
    concursos: text("concursos", { mode: "json" }).$type<string[]>().notNull(),
    banca: text("banca").notNull(),
    cargo: text("cargo").notNull(),
    dificuldade: integer("dificuldade").notNull(),
    enunciado: text("enunciado").notNull(),
    alternativas: text("alternativas", { mode: "json" }).$type<Alternativa[]>().notNull(),
    gabarito: text("gabarito").notNull(),
    comentario: text("comentario").notNull(),
    analiseAlternativas: text("analise_alternativas", { mode: "json" }).$type<AnaliseAlternativa[]>().notNull(),
    fundamentoLegal: text("fundamento_legal"),
    fundamentoJurisprudencial: text("fundamento_jurisprudencial"),
    observacaoTemporal: text("observacao_temporal"),
    pegadinha: text("pegadinha"),
    destaques: text("destaques", { mode: "json" }).$type<{ tipo: string; texto: string }[]>(),
    tipoCobranca: text("tipo_cobranca"),
    exigenciaCognitiva: text("exigencia_cognitiva"),
    palavrasChave: text("palavras_chave", { mode: "json" }).$type<string[]>(),
    leiReferencia: text("lei_referencia"),
    dataCorteLegislativo: text("data_corte_legislativo").notNull(),
    auditoria: text("auditoria", { mode: "json" }).$type<ResultadoAuditoria>().notNull(),
    lote: text("lote").notNull(),
    criadoEm: integer("criado_em", { mode: "timestamp" }).notNull(),
    revisadoEm: integer("revisado_em", { mode: "timestamp" }),
    /** E-mail de quem aprovou ou rejeitou. */
    revisadoPor: text("revisado_por"),
    /** Motivo da rejeição ou observação da aprovação. */
    motivoRevisao: text("motivo_revisao"),
    /** Comentário como foi para "questoes" (montado dos campos acima e, se editado, a versão editada). */
    comentarioFinal: text("comentario_final"),
  },
  (t) => [index("questoes_revisao_status").on(t.status, t.topicoTaxonomia)],
);
