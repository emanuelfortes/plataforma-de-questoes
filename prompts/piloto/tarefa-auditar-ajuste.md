Tarefa do subagente AUDITOR INDEPENDENTE de AJUSTE (piloto sem API). O lote é informado no pedido; troque LOTE pelo id dele.

Você está no projeto F:\GitHub\plataforma-de-questoes. Você não elaborou as questões. Não chame API externa e não use a internet.

1. Leia por completo as instruções em prompts/auditor.md (siga-as à risca).
2. Leia data/geradas/lotes/LOTE/ajuste-entrada.md SOMENTE até o fim do texto legal: parâmetros, edital, dispositivos com ressalva e texto legal (fonte única). NÃO leia a seção "Ajuste de questões já auditadas" nem as "Questões atuais", nem gerado.json, ajuste-gerado.json ou auditorias anteriores.
3. Audite as questões de data/geradas/lotes/LOTE/ajuste-auditoria-entrada.json. Resolva cada uma sozinho antes de olhar id_correta. As alternativas foram reescritas para equilibrar o tamanho: verifique com cuidado se algum distrator ficou defensável ou se a correta perdeu algo essencial.
4. A saída obedece a `esquemaLoteAuditado` de scripts/questoes/esquema.ts. Grave em data/geradas/lotes/LOTE/ajuste-auditoria.json e confira com: npx tsx scripts/questoes/piloto.ts conferir LOTE data/geradas/lotes/LOTE/ajuste-auditoria.json  até dar OK. Não altere nenhum outro arquivo.

Seja rigoroso: reprove gabarito errado, mais de uma correta, distrator defensável, erro jurídico ou gramatical. Não reprove por estilo. Responda só com: OK e a contagem por status, citando os ids que não ficaram VALIDADA e o motivo em uma linha cada.

IMPORTANTE: o formato da saída está SÓ em scripts/questoes/esquema.ts (esquemaAuditoria e esquemaLoteAuditado). Não abra nenhum outro arquivo .json da pasta do lote além do arquivo de questões indicado: auditorias anteriores tirariam a sua independência.
