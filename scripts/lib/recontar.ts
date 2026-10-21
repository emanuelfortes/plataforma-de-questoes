import { sql } from "drizzle-orm";
import type { Db } from "../../src/db";

/**
 * Recalcula a tabela "contagens". Roda ao fim de toda importação. Itens suspensos (reportados) não contam.
 * Custa uma leitura completa de questoes/flashcards (no Turso, ~3 leituras por questão), por isso
 * só acontece aqui e nunca numa requisição de página.
 */
export async function recontar(db: Db) {
  await db.transaction(async (tx) => {
    await tx.run(sql`DELETE FROM contagens`);
    await tx.run(sql`INSERT INTO contagens (chave, total) SELECT 'q:total', COUNT(*) FROM questoes WHERE suspensa = 0`);
    await tx.run(sql`
      INSERT INTO contagens (chave, total)
      SELECT 'q:d:' || disciplina_id, COUNT(*) FROM questoes WHERE suspensa = 0 GROUP BY disciplina_id`);
    await tx.run(sql`
      INSERT INTO contagens (chave, total)
      SELECT 'q:a:' || assunto_id, COUNT(*) FROM questoes WHERE assunto_id IS NOT NULL AND suspensa = 0 GROUP BY assunto_id`);
    // Certo ou errado (mesma regra de ehCertoErrado em src/lib/filtros.ts): liga a opção "Tipo de questão" no filtro.
    await tx.run(sql`
      INSERT INTO contagens (chave, total)
      SELECT 'q:ce', COUNT(*) FROM questoes WHERE suspensa = 0 AND json_array_length(alternativas) = 2
        AND EXISTS (SELECT 1 FROM json_each(alternativas) WHERE lower(trim(json_extract(value, '$.texto'))) = 'certo')`);
    await tx.run(sql`INSERT INTO contagens (chave, total) SELECT 'f:total', COUNT(*) FROM flashcards WHERE suspensa = 0`);
    await tx.run(sql`
      INSERT INTO contagens (chave, total)
      SELECT 'f:d:' || disciplina_id, COUNT(*) FROM flashcards WHERE suspensa = 0 GROUP BY disciplina_id`);
    await tx.run(sql`
      INSERT INTO contagens (chave, total)
      SELECT 'f:a:' || assunto_id, COUNT(*) FROM flashcards WHERE assunto_id IS NOT NULL AND suspensa = 0 GROUP BY assunto_id`);
  });
}
