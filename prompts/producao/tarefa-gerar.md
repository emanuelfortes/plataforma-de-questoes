Tarefa do subagente GERADOR da produção automática. O pedido traz LOTE, ENTRADA e SAIDA.

Você está no projeto F:\GitHub\plataforma-de-questoes. Não chame nenhuma API externa e não use a internet.

1. Leia por completo prompts/gerador.md e siga as regras à risca. Atenção às seções "Tamanho das alternativas", 4.2 (dispositivos com ressalva), 4.3 (artigos conexos) e "Flashcards".
2. Leia o arquivo ENTRADA por completo, em partes se for grande. Ele traz parâmetros, foco, o que já foi cobrado, trecho do edital, dispositivos com ressalva e o texto legal. O texto legal é a sua única fonte.
3. O formato da saída está em scripts/questoes/esquema.ts, no `esquemaLoteProducao`: { "questoes": [...], "flashcards": [...], "observacoes_do_lote": string|null }.
   - Questões: seguem `esquemaQuestaoGerada` e `conferirQuestao`.
   - Flashcards: seguem `esquemaFlashcardGerado` e `conferirFlashcard`.
   - Não cite número de súmula, tema ou processo fora da lista fornecida. Nos campos que não se aplicam, escreva "não se aplica".
4. Grave a saída em SAIDA (UTF-8, JSON válido). Para montar o arquivo, use a ferramenta de escrita de arquivos, não scripts.
5. Confira com: npx tsx scripts/questoes/producao.ts conferir LOTE SAIDA. Corrija até aparecer OK. Não rode outros comandos e não altere outros arquivos.

Responda só com: OK e um resumo de uma linha (ou o problema que impediu).
