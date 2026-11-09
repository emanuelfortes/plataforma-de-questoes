// Avisos por e-mail já enviados, um por pessoa e assunto (ex.: "simulado:1"). Garante que ninguém receba o mesmo
// aviso duas vezes, mesmo com dois disparos ao mesmo tempo (quem grava a linha primeiro é quem envia), e permite
// continuar no dia seguinte quando o limite diário do e-mail acaba. usuario_id "*" marca o aviso como concluído.
// Sem chave estrangeira de propósito: o "*" não é um usuário, e apagar a conta não precisa apagar o histórico.
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const avisosEnviados = sqliteTable(
  "avisos_enviados",
  {
    chave: text("chave").notNull(),
    usuarioId: text("usuario_id").notNull(),
    enviadoEm: integer("enviado_em", { mode: "timestamp" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.chave, t.usuarioId] })],
);
