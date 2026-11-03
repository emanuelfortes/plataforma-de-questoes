// Monitores: alunos com tudo liberado (como assinante da Tropa de Elite) sem pagar. Não entram na área do dono.
// O dono marca e desmarca em /admin/pessoas. Uma linha por monitor.
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const monitores = sqliteTable("monitores", {
  usuarioId: text("usuario_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  criadoEm: integer("criado_em", { mode: "timestamp" }).notNull(),
});
