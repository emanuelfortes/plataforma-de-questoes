Tarefa do subagente AUDITOR INDEPENDENTE em REAUDITORIA (piloto sem API). O lote é informado no pedido; troque LOTE pelo id dele.

Você está no projeto F:\GitHub\plataforma-de-questoes. Você não elaborou as questões. Não chame API externa e não use a internet.

1. Leia por completo as instruções em prompts/auditor.md (siga-as à risca).
2. Leia data/geradas/lotes/LOTE/reauditoria-entrada.md: parâmetros, edital, a seção "Reauditoria", os "Dispositivos com ressalva obrigatória" e o texto legal (fonte única, agora com artigos conexos). Não leia outros arquivos do lote.
3. Audite as questões de data/geradas/lotes/LOTE/reauditoria-questoes.json. Resolva cada uma sozinho antes de olhar id_correta.
4. A saída obedece a `esquemaLoteAuditado` de scripts/questoes/esquema.ts ({ "auditorias": [ uma por questão ] }). Grave em data/geradas/lotes/LOTE/reauditoria.json e confira com: npx tsx scripts/questoes/ajustes.ts registrar-reauditoria LOTE  até dar válido. Não altere nenhum outro arquivo.

Foque no que o recorte novo muda: exceções em artigos conexos (juiz das garantias, arts. 28, 107, 155 e 184 do CPP, Lei 12.830/2013) e dispositivos sensíveis sem a nota. Não reprove por estilo nem por tamanho das alternativas (isso é tratado em outra etapa). Responda só com: OK e a contagem por status, citando os ids que não ficaram VALIDADA e o motivo em uma linha cada.

IMPORTANTE: o formato da saída está SÓ em scripts/questoes/esquema.ts (esquemaAuditoria e esquemaLoteAuditado). Não abra nenhum outro arquivo .json da pasta do lote além do arquivo de questões indicado: auditorias anteriores tirariam a sua independência.
