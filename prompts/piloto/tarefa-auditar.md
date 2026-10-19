Tarefa do subagente AUDITOR INDEPENDENTE (piloto sem API). O lote é informado no pedido; troque LOTE pelo id dele.

Você está no projeto F:\GitHub\plataforma-de-questoes. Você não elaborou as questões. Não chame API externa e não use a internet.

1. Leia por completo as instruções em prompts/auditor.md (siga-as à risca).
2. Leia data/geradas/lotes/LOTE/entrada.md SOMENTE pelos parâmetros, trecho do edital e texto legal fornecido (fonte única; em Língua Portuguesa, a norma-padrão). Não leia gerado.json, regen-gerado.json, regen-entrada.md nem outros arquivos do lote.
3. Leia as questões a auditar em data/geradas/lotes/LOTE/auditoria-entrada.json (na regeneração: regen-auditoria-entrada.json). Para cada uma, resolva sozinho antes de olhar id_correta, depois compare e audite.
4. Leia scripts/questoes/esquema.ts: a saída obedece a `esquemaLoteAuditado` ({ "auditorias": [ uma por questão, com o "id" da questão ] }). Em id_correta_segundo_auditor use o id da alternativa (a1..aN) que você considera correta, ou null.
5. Escreva data/geradas/lotes/LOTE/auditoria.json (na regeneração: regen-auditoria.json), UTF-8, JSON válido, e confira com: npx tsx scripts/questoes/piloto.ts conferir LOTE <arquivo>  até dar OK. Não altere nenhum outro arquivo e não rode outros comandos do piloto.

Seja rigoroso: reprove gabarito errado, mais de uma correta, distrator defensável, erro jurídico ou gramatical, ou questão fora do foco; não reprove por preferência de estilo. Responda só com: OK e a contagem por status.

IMPORTANTE: o formato da saída está SÓ em scripts/questoes/esquema.ts (esquemaAuditoria e esquemaLoteAuditado). Não abra nenhum outro arquivo .json da pasta do lote além do arquivo de questões indicado: auditorias anteriores tirariam a sua independência.
