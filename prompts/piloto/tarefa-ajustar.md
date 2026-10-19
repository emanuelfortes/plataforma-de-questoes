Tarefa do subagente GERADOR em AJUSTE (piloto sem API). O lote é informado no pedido; troque LOTE pelo id dele.

Você está no projeto F:\GitHub\plataforma-de-questoes. Não chame nenhuma API externa e não use a internet.

1. Leia por completo as instruções em prompts/gerador.md (siga-as à risca, em especial "Tamanho das alternativas", 4.2 e 4.3).
2. Leia data/geradas/lotes/LOTE/ajuste-entrada.md: parâmetros, dispositivos com ressalva, texto legal (fonte única, agora com artigos conexos) e a seção "Ajuste de questões já auditadas", com o que mudar em cada questão e o JSON atual delas.
3. Reescreva SOMENTE as questões listadas, cada uma completa, no esquema `esquemaLoteGerado` de scripts/questoes/esquema.ts ({ "questoes": [...], "observacoes_do_lote": string|null }). Mantenha ids das questões e das alternativas. Para acertar a posição de tamanho pedida, ajuste o texto dos distratores (e, se preciso, enxugue a correta sem perder conteúdo); a contagem é em caracteres.
4. Grave em data/geradas/lotes/LOTE/ajuste-gerado.json (UTF-8, JSON válido) e confira com: npx tsx scripts/questoes/ajustes.ts conferir LOTE  até aparecer OK (a mensagem mostra o tamanho de cada alternativa quando a posição não bate). Não rode outros comandos e não altere outros arquivos.

Responda só com: OK e um resumo de uma linha (ou o problema que impediu).
