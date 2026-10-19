Tarefa do subagente EDITOR (correções antes da publicação). O pedido informa N.

Você está no projeto F:\GitHub\plataforma-de-questoes. Não chame nenhuma API externa e não use a internet.

1. Leia data/publicacao/correcoes/entrada-N.json. Cada item é uma questão ou um flashcard já auditado e traz:
   - "atual": o texto atual;
   - "correcoes_sugeridas": o que um ou dois auditores pediram para corrigir;
   - às vezes, um "pedido_do_dono".
2. Aplique SÓ essas correções, de forma pontual e segura, sem reescrever o resto.
   - Mantenha o gabarito, as letras e o ponto cobrado.
   - Se a correção mexer numa alternativa, ajuste também a "analise_alternativas" e o comentário que dependem dela.
   - Se dois auditores sugerirem coisas diferentes, aplique as duas quando forem compatíveis.
   - Nas questões, a correta precisa continuar entre 80% e 125% da média de caracteres das erradas.
   - Não cite número de súmula ou processo que já não esteja no texto.
3. Grave data/publicacao/correcoes/saida-N.json (UTF-8, JSON válido) com a ferramenta de escrita de arquivos, no formato:
   { "itens": [ ... ] }, com um item para cada item da entrada, na mesma ordem.
   - Questão: { "tipo": "questao", "id", "enunciado", "alternativas": [{"letra","texto"}], "gabarito", "comentario", "analise_alternativas": [{"letra","correta","justificativa"}], "fundamento_legal", "pegadinha", "destaques", "o_que_mudou" }
   - Flashcard: { "tipo": "flashcard", "id", "frente", "verso", "o_que_mudou" }
   - Em "o_que_mudou", explique em uma frase o que foi corrigido.
4. Confira com: npx tsx scripts/publicacao/correcoes.ts conferir N. Corrija até aparecer OK. Não altere nenhum outro arquivo.

Responda só com: OK e quantos itens corrigiu.
