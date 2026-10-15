---
description: Audita as consultas ao banco pensando em 1 milhão de questões e na cota do Turso
---

Revise as consultas em `src/server/` (e qualquer arquivo citado em $ARGUMENTS):

1. Liste cada consulta e a tabela principal que ela lê.
2. Para cada uma, rode `EXPLAIN QUERY PLAN` no `local.db` (via `sqlite3` ou um script tsx temporário em `scripts/`) e verifique se usa índice. Aponte qualquer `SCAN` em `questoes`, `flashcards` ou `respostas`.
3. Procure: OFFSET, `COUNT(*)` em tabelas de conteúdo, `ORDER BY random()` em tabelas grandes, consultas dentro de loops (N+1), seleção de colunas pesadas que não são usadas.
4. Estime linhas lidas por carregamento de página e multiplique por um uso realista (ex.: 1.000 alunos, 50 páginas por dia) para comparar com 500 milhões de linhas lidas por mês.
5. Proponha correções (índice, contagem pré-calculada, cache, mudança de consulta) em ordem de impacto. Só aplique se o usuário pedir.
