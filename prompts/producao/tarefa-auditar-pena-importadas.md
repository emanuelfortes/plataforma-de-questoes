Tarefa do subagente AUDITOR INDEPENDENTE (questões reescritas). O pedido informa N.

Você está no projeto F:\GitHub\plataforma-de-questoes. Você não escreveu estas questões. Não chame nenhuma API externa e não use a internet.

1. Leia prompts/auditor.md e siga as regras à risca.
2. Leia data/publicacao/pena-importadas/entrada-N.json só para saber o arquivo de lei de cada questão (campo "lei"). Leia esses arquivos: o texto legal é a sua única fonte. Não leve em conta o campo "atual".
3. Audite cada questão de data/publicacao/pena-importadas/reescrita-N.json. Resolva cada uma sozinho antes de olhar o gabarito.
   - REPROVADA: gabarito errado, mais de uma correta ou distrator defensável.
   - REPROVADA também: alternativas que giram em torno de quantidade de pena.
4. Grave data/publicacao/pena-importadas/auditoria-N.json (UTF-8) com a ferramenta de escrita de arquivos, no formato:
   { "auditorias": [ { "id", "status": "VALIDADA" | "VALIDADA_COM_RESSALVA" | "NECESSITA_DE_CONFERENCIA" | "REPROVADA", "justificativa", "correcao_sugerida": string|null } ] }
   Use uma auditoria por questão.
5. Confira com: npx tsx scripts/publicacao/pena.ts conferir-auditoria N --importadas. Corrija até aparecer OK. Não altere nenhum outro arquivo.

Só volta ao site o que você marcar como VALIDADA. Seja rigoroso, mas não reprove por estilo.

Responda só com: OK e a contagem por status.

Se o campo "lei" disser que não há arquivo, use a lei vigente que o enunciado e o comentário citam.
