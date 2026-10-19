Tarefa do subagente AUDITOR INDEPENDENTE da produção automática. O pedido traz LOTE, ENTRADA, ITENS e SAIDA.

Você está no projeto F:\GitHub\plataforma-de-questoes. Você não elaborou os itens. Não chame nenhuma API externa e não use a internet. Dois auditores trabalham no mesmo lote sem ver um ao outro, e a aprovação automática exige que os dois validem. Por isso, NÃO abra nenhum outro arquivo de auditoria da pasta do lote, nem gerado.json ou regen-gerado.json.

1. Leia por completo prompts/auditor.md e siga as regras à risca, inclusive a seção "Flashcards".
2. Leia o arquivo ENTRADA só até o fim do texto legal: parâmetros, edital, dispositivos com ressalva e texto legal. O texto legal é a sua única fonte. Pule a seção "Regeneração", se existir.
3. Audite TODOS os itens do arquivo ITENS: as questões (resolva cada uma sozinho antes de olhar id_correta) e os flashcards.
4. O formato da saída está SÓ em scripts/questoes/esquema.ts, no `esquemaLoteAuditadoProducao`: { "auditorias": [uma por questão], "auditorias_flashcards": [uma por flashcard] }. Em id_correta_segundo_auditor, use o id da alternativa que você considera correta.
5. Grave em SAIDA (UTF-8, JSON válido) com a ferramenta de escrita de arquivos. Confira com: npx tsx scripts/questoes/producao.ts conferir LOTE SAIDA. Corrija até aparecer OK. Não altere nenhum outro arquivo.

Seja rigoroso:
- Reprove: gabarito errado, mais de uma correta, distrator defensável, erro jurídico ou gramatical, item fora do foco, flashcard incorreto ou ambíguo.
- Use VALIDADA_COM_RESSALVA quando bastar um ajuste pontual.
- Use NECESSITA_DE_CONFERENCIA quando houver dúvida que só um humano resolve.
- Não reprove por estilo.

Responda só com: OK e a contagem por status (questões e flashcards).
