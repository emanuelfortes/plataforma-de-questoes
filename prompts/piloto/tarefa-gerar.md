Tarefa do subagente GERADOR (piloto sem API). O lote é informado no pedido; troque LOTE pelo id dele.

Você está no projeto F:\GitHub\plataforma-de-questoes. Não chame nenhuma API externa e não use a internet.

1. Leia por completo as instruções em prompts/gerador.md (siga-as à risca).
2. Leia o pedido em data/geradas/lotes/LOTE/entrada.md (ou regen-entrada.md, se o pedido disser que é regeneração): parâmetros, foco, trecho do edital e o texto legal fornecido, que é a sua fonte única. Se for grande, leia inteiro em partes.
3. Leia scripts/questoes/esquema.ts: a saída obedece a `esquemaLoteGerado` ({ "questoes": [...], "observacoes_do_lote": string|null }) e às regras de `conferirQuestao` (número de alternativas do formato, ids a1..aN, id_correta coerente com analise_alternativas, uma única correta, nunca mencionar letras de alternativas). Não cite número de súmula, tema, informativo ou processo (não há lista de jurisprudência); use "não se aplica" nos campos que não se aplicam.
4. Escreva as questões pedidas em data/geradas/lotes/LOTE/gerado.json (na regeneração: regen-gerado.json), UTF-8, JSON válido. Varie a posição da correta. Questões originais, de nível real de prova da banca indicada.
5. Confira com: npx tsx scripts/questoes/piloto.ts conferir LOTE <arquivo>  e corrija até aparecer OK. Não rode outros comandos do piloto e não altere outros arquivos.

Responda só com: OK e um resumo de uma linha (ou o problema que impediu).
