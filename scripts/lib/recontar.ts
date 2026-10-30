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
    // Por dificuldade e certo ou errado, em cada escopo (banco, matéria, área): as mesmas chaves de
    // chavesDoItem (src/lib/contagens.ts). Certo ou errado segue ehCertoErrado (src/lib/filtros.ts).
    const escopos = [
      { prefixo: sql`'q'`, onde: sql`1 = 1`, grupo: sql`` },
      { prefixo: sql`'q:d:' || disciplina_id`, onde: sql`1 = 1`, grupo: sql`, disciplina_id` },
      { prefixo: sql`'q:a:' || assunto_id`, onde: sql`assunto_id IS NOT NULL`, grupo: sql`, assunto_id` },
    ];
    const ce = sql.raw(`json_array_length(alternativas) = 2 AND EXISTS (SELECT 1 FROM json_each(alternativas) WHERE lower(trim(json_extract(value, '$.texto'))) = 'certo')`);
    for (const e of escopos) {
      await tx.run(sql`
        INSERT INTO contagens (chave, total)
        SELECT ${e.prefixo} || ':n' || dificuldade, COUNT(*) FROM questoes
        WHERE suspensa = 0 AND dificuldade BETWEEN 1 AND 3 AND ${e.onde} GROUP BY dificuldade${e.grupo}`);
      await tx.run(sql`
        INSERT INTO contagens (chave, total)
        SELECT ${e.prefixo} || ':ce', COUNT(*) FROM questoes
        WHERE suspensa = 0 AND ${ce} AND ${e.onde} GROUP BY 1`);
      await tx.run(sql`
        INSERT INTO contagens (chave, total)
        SELECT ${e.prefixo} || ':n' || dificuldade || ':ce', COUNT(*) FROM questoes
        WHERE suspensa = 0 AND dificuldade BETWEEN 1 AND 3 AND ${ce} AND ${e.onde} GROUP BY dificuldade${e.grupo}`);
    }
    await tx.run(sql`INSERT INTO contagens (chave, total) SELECT 'f:total', COUNT(*) FROM flashcards WHERE suspensa = 0`);
    await tx.run(sql`
      INSERT INTO contagens (chave, total)
      SELECT 'f:d:' || disciplina_id, COUNT(*) FROM flashcards WHERE suspensa = 0 GROUP BY disciplina_id`);
    await tx.run(sql`
      INSERT INTO contagens (chave, total)
      SELECT 'f:a:' || assunto_id, COUNT(*) FROM flashcards WHERE assunto_id IS NOT NULL AND suspensa = 0 GROUP BY assunto_id`);
    // Vade Mecum: questões por artigo de lei (só onde a tabela de ligação já existe).
    const ligacao = await tx.all(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'artigos_questao'`);
    if (ligacao.length)
      await tx.run(sql`
        INSERT INTO contagens (chave, total)
        SELECT 'v:' || a.lei || ':' || a.artigo, COUNT(*) FROM artigos_questao a JOIN questoes q ON q.id = a.questao_id
        WHERE q.suspensa = 0 GROUP BY a.lei, a.artigo`);
  });
}
