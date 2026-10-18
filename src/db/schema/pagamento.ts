// Assinaturas e cobranças do Mercado Pago. Gravadas pelo webhook e pelo retorno do checkout;
// o dinheiro é sempre conferido na API do Mercado Pago (nunca confiamos no que o aviso diz).
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const assinaturas = sqliteTable(
  "assinaturas",
  {
    /** id da assinatura (preapproval) no Mercado Pago. */
    id: text("id").primaryKey(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** pending (aguardando pagamento), authorized (ativa), paused, cancelled. */
    status: text("status").notNull(),
    /** Valor mensal em centavos. */
    valorCentavos: integer("valor_centavos").notNull(),
    /** Até quando o acesso está pago: segue valendo depois de cancelar, até esta data. */
    acessoAte: integer("acesso_ate", { mode: "timestamp" }),
    criadaEm: integer("criada_em", { mode: "timestamp" }).notNull(),
    atualizadaEm: integer("atualizada_em", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("assinaturas_usuario").on(t.usuarioId, t.atualizadaEm)],
);

/** Cada cobrança mensal (authorized_payment no Mercado Pago). Fonte do faturamento. */
export const pagamentos = sqliteTable(
  "pagamentos",
  {
    id: text("id").primaryKey(),
    assinaturaId: text("assinatura_id").notNull(),
    usuarioId: text("usuario_id").references(() => user.id, { onDelete: "set null" }),
    valorCentavos: integer("valor_centavos").notNull(),
    /** Situação do pagamento: approved, rejected, pending, refunded... */
    status: text("status").notNull(),
    /** Data da cobrança (UTC). */
    cobradoEm: integer("cobrado_em", { mode: "timestamp" }).notNull(),
    atualizadoEm: integer("atualizado_em", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("pagamentos_data").on(t.cobradoEm), index("pagamentos_assinatura").on(t.assinaturaId)],
);
