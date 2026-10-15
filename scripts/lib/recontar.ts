import { sql } from "drizzle-orm";
import type { Db } from "../../src/db";

/**
 * Recalcula a tabela "contagens". Roda ao fim de toda importação.
 * Custa uma leitura completa de questoes/flashcards (no Turso, ~3 leituras por questão), por isso
 * só acontece aqui e nunca numa requisição de página.
 */
export async function recontar(db: Db) {
  await db.transaction(async (tx) => {
    await tx.run(sql`DELETE FROM contagens`);
    await tx.run(sql`INSERT INTO contagens (chave, total) SELECT 'q:total', COUNT(*) FROM questoes`);
    await tx.run(sql`
      INSERT INTO contagens (chave, total)
      SELECT 'q:d:' || disciplina_id, COUNT(*) FROM questoes GROUP BY disciplina_id`);
    await tx.run(sql`
      INSERT INTO contagens (chave, total)
      SELECT 'q:a:' || assunto_id, COUNT(*) FROM questoes WHERE assunto_id IS NOT NULL GROUP BY assunto_id`);
    await tx.run(sql`INSERT INTO contagens (chave, total) SELECT 'f:total', COUNT(*) FROM flashcards`);
    await tx.run(sql`
      INSERT INTO contagens (chave, total)
      SELECT 'f:d:' || disciplina_id, COUNT(*) FROM flashcards GROUP BY disciplina_id`);
    await tx.run(sql`
      INSERT INTO contagens (chave, total)
      SELECT 'f:a:' || assunto_id, COUNT(*) FROM flashcards WHERE assunto_id IS NOT NULL GROUP BY assunto_id`);
  });
}
