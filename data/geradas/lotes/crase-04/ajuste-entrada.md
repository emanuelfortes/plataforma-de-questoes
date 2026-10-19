# Pedido de geração: lote crase-04

## Parâmetros da produção
- Disciplina: Língua Portuguesa
- Tema: Crase
- Subtemas do tema: não especificados
- Foco deste lote (não saia dele): Aplicação em reescrita de frases e em trechos de texto: indicação de horas, distância determinada, 'à moda de', 'à distância', paralelismo e mudança de sentido com e sem crase.
- Cargo: Inspetor e Escrivão de Polícia Civil
- Órgão: Polícia Civil do Estado do Ceará
- Banca examinadora: IDECAN
- Número de alternativas por questão: 4 (as letras A, B, C, D serão atribuídas pelo sistema depois; use ids a1 a a4)
- Quantidade de questões: 10 (ids q01 a q10)
- Dificuldade: 3 fáceis (q01 a q03), 4 médias (q04 a q07) e 3 difíceis (q08 a q10)
- Objetivo: PLATAFORMA
- Data de corte legislativo: 2026-10-18
- Data de corte jurisprudencial: 2026-10-18
- Lista de jurisprudência fornecida (só estes podem ser citados pelo número): nenhuma (não cite número de súmula, tema ou processo)
- Perfil da banca: sem questões anteriores fornecidas; use apenas características gerais conhecidas da banca.
- Tamanho das alternativas: a correta não pode ser mais de 25% mais longa que a média das erradas, e no lote ela deve ser a mais longa em no máximo 4 das 10 questões (verificado em código).

## Trecho do edital (PCCE Inspetor e Escrivão 2021)
Domínio da estrutura morfossintática do período: (...) emprego dos sinais de pontuação; concordância verbal e nominal; emprego do sinal indicativo de crase; colocação dos pronomes átonos.

## Ajuste de questões já auditadas
Reescreva SOMENTE as questões listadas abaixo, mantendo ids, tema, dificuldade e o ponto cobrado. Devolva cada questão completa (todos os campos), atualizando analise_alternativas, comentário e fundamentos para refletir o novo texto. Não mencione letras de alternativas.

### q04
- Tamanho: hoje a correta é a 1ª mais longa (33 caracteres; média das erradas 32). Reescreva as alternativas para que a correta fique na posição 3 do ranking de tamanho (1 = a mais longa) e no máximo 25% acima da média das erradas. Prefira enriquecer os distratores com detalhes plausíveis do mesmo nível (prazos, condições, remissões) a cortar informação da correta, e não mude o que torna cada alternativa certa ou errada.
- Mantenha o mesmo id_correta e os mesmos ids de alternativas.

### q05
- Tamanho: hoje a correta é a 1ª mais longa (136 caracteres; média das erradas 87). Reescreva as alternativas para que a correta fique na posição 2 do ranking de tamanho (1 = a mais longa) e no máximo 25% acima da média das erradas. Prefira enriquecer os distratores com detalhes plausíveis do mesmo nível (prazos, condições, remissões) a cortar informação da correta, e não mude o que torna cada alternativa certa ou errada.
- Mantenha o mesmo id_correta e os mesmos ids de alternativas.

### q06
- Tamanho: hoje a correta é a 1ª mais longa (10 caracteres; média das erradas 10). Reescreva as alternativas para que a correta fique na posição 3 do ranking de tamanho (1 = a mais longa) e no máximo 25% acima da média das erradas. Prefira enriquecer os distratores com detalhes plausíveis do mesmo nível (prazos, condições, remissões) a cortar informação da correta, e não mude o que torna cada alternativa certa ou errada.
- Aproveite também a correção sugerida pelo auditor: Trocar "o inquérito havia sido instaurado ___ cerca de dez dias" por "o inquérito foi instaurado ___ cerca de dez dias", mantendo alternativas e gabarito.
- Mantenha o mesmo id_correta e os mesmos ids de alternativas.

## Questões atuais (JSON)
[
  {
    "id": "q04",
    "tema": "Crase",
    "subtema": "Paralelismo nas expressões de intervalo",
    "dificuldade": "media",
    "enunciado": "Considere a frase: \"O atendimento ao público na delegacia ocorre ___ segunda ___ sexta, ___ 8h ___ 17h.\" Assinale o preenchimento que respeita a norma-padrão quanto ao emprego do sinal indicativo de crase e ao paralelismo.",
    "alternativas": [
      {
        "id": "a1",
        "texto": "de segunda à sexta, das 8h às 17h"
      },
      {
        "id": "a2",
        "texto": "de segunda a sexta, das 8h às 17h"
      },
      {
        "id": "a3",
        "texto": "da segunda a sexta, de 8h às 17h"
      },
      {
        "id": "a4",
        "texto": "de segunda a sexta, de 8h às 17h"
      }
    ],
    "id_correta": "a2",
    "comentario_geral": "Nas expressões de intervalo, a construção deve ser paralela: se o início vem sem artigo (\"de\"), o fim também vem sem artigo (\"a\"); se o início vem com artigo (\"da\", \"das\"), o fim também leva artigo e, por isso, crase (\"à\", \"às\"). Assim: \"de segunda a sexta\" e \"das 8h às 17h\".",
    "analise_alternativas": [
      {
        "id": "a1",
        "correta": false,
        "justificativa": "\"De segunda\" está sem artigo, então o fim do intervalo também deve ficar sem artigo: \"a sexta\", sem crase."
      },
      {
        "id": "a2",
        "correta": true,
        "justificativa": "Os dois intervalos estão paralelos: \"de... a\" (sem artigo) e \"das... às\" (com artigo)."
      },
      {
        "id": "a3",
        "correta": false,
        "justificativa": "Quebra o paralelismo nos dois intervalos: \"da\" pede \"à\", e \"de 8h\" pede \"a 17h\", sem crase."
      },
      {
        "id": "a4",
        "correta": false,
        "justificativa": "O primeiro intervalo está correto, mas \"de 8h às 17h\" quebra o paralelismo; seria \"de 8h a 17h\" ou \"das 8h às 17h\"."
      }
    ],
    "fundamento_legal": "não se aplica",
    "fundamento_jurisprudencial": "não se aplica",
    "observacao_temporal": "não se aplica",
    "pegadinha": "Misturar \"de\" com \"à\" (ou \"de\" com \"às\"), quebrando o paralelismo entre o início e o fim do intervalo.",
    "lei_referencia": "não se aplica",
    "macete_do_riccardo": "\"De\" combina com \"a\"; \"da\" combina com \"à\"; \"das\" combina com \"às\".",
    "fique_ligado": null,
    "cuidado_na_prova": null,
    "tipo_cobranca": "aplicacao_pratica",
    "exigencia_cognitiva": "aplicacao",
    "palavras_chave": [
      "crase",
      "paralelismo",
      "intervalo",
      "horas",
      "dias da semana"
    ],
    "cita_jurisprudencia": false,
    "status_gerador": "VALIDADA",
    "ressalvas": null,
    "fontes_consultadas": [
      "Conhecimento consolidado da norma-padrão da língua portuguesa (não há texto legal para este tema)"
    ]
  },
  {
    "id": "q05",
    "tema": "Crase",
    "subtema": "Mudança de sentido com e sem crase",
    "dificuldade": "media",
    "enunciado": "Leia as frases a seguir.\nI. \"Os sequestradores mataram a fome dos reféns.\"\nII. \"Os sequestradores mataram à fome os reféns.\"\nSobre o emprego do acento grave e o sentido das frases, é correto afirmar que",
    "alternativas": [
      {
        "id": "a1",
        "texto": "as duas frases têm o mesmo sentido, e o acento grave em II é facultativo."
      },
      {
        "id": "a2",
        "texto": "em II, o acento grave está incorreto, pois \"matar\" é verbo transitivo direto e não exige preposição."
      },
      {
        "id": "a3",
        "texto": "em I, \"a fome\" é objeto direto e indica que os reféns foram alimentados; em II, \"à fome\" indica o meio pelo qual os reféns foram mortos."
      },
      {
        "id": "a4",
        "texto": "em I, deveria haver acento grave, já que \"fome\" é palavra feminina antecedida de artigo."
      }
    ],
    "id_correta": "a3",
    "comentario_geral": "Em I, \"a fome\" é objeto direto de \"mataram\" (só artigo, sem preposição): os sequestradores saciaram a fome dos reféns. Em II, o objeto direto é \"os reféns\", e \"à fome\" é adjunto adverbial de meio, formado por preposição mais artigo: os reféns foram mortos por falta de alimento. O acento grave, portanto, muda a função sintática e o sentido.",
    "analise_alternativas": [
      {
        "id": "a1",
        "correta": false,
        "justificativa": "Os sentidos são opostos (alimentar os reféns e matá-los de fome), e o acento em II não é facultativo, pois marca a locução adverbial."
      },
      {
        "id": "a2",
        "correta": false,
        "justificativa": "A preposição de \"à fome\" não vem da regência de \"matar\", mas do adjunto adverbial de meio; o objeto direto em II é \"os reféns\"."
      },
      {
        "id": "a3",
        "correta": true,
        "justificativa": "Descreve corretamente as duas funções: objeto direto em I e adjunto adverbial de meio em II, com a consequente mudança de sentido."
      },
      {
        "id": "a4",
        "correta": false,
        "justificativa": "Em I, \"a fome\" é objeto direto de verbo transitivo direto: há só o artigo, sem preposição, logo não há crase."
      }
    ],
    "fundamento_legal": "não se aplica",
    "fundamento_jurisprudencial": "não se aplica",
    "observacao_temporal": "não se aplica",
    "pegadinha": "Achar que o acento grave depende só da regência do verbo, sem perceber que ele pode marcar um adjunto adverbial e alterar o sentido.",
    "lei_referencia": "não se aplica",
    "macete_do_riccardo": null,
    "fique_ligado": "Antes de analisar a crase, pergunte qual é o objeto direto da frase: se ele já existe, o \"à\" pode estar formando um adjunto adverbial.",
    "cuidado_na_prova": null,
    "tipo_cobranca": "interpretacao",
    "exigencia_cognitiva": "analise",
    "palavras_chave": [
      "crase",
      "mudança de sentido",
      "objeto direto",
      "adjunto adverbial"
    ],
    "cita_jurisprudencia": false,
    "status_gerador": "VALIDADA",
    "ressalvas": null,
    "fontes_consultadas": [
      "Conhecimento consolidado da norma-padrão da língua portuguesa (não há texto legal para este tema)"
    ]
  },
  {
    "id": "q06",
    "tema": "Crase",
    "subtema": "Horas, tempo decorrido e tempo futuro",
    "dificuldade": "media",
    "enunciado": "Considere o trecho: \"O mandado foi cumprido ___ uma hora da madrugada; o inquérito havia sido instaurado ___ cerca de dez dias, e o relatório deverá ficar pronto daqui ___ duas semanas.\" Assinale a sequência que preenche corretamente as lacunas.",
    "alternativas": [
      {
        "id": "a1",
        "texto": "a – há – à"
      },
      {
        "id": "a2",
        "texto": "à – a – há"
      },
      {
        "id": "a3",
        "texto": "há – à – a"
      },
      {
        "id": "a4",
        "texto": "à – há – a"
      }
    ],
    "id_correta": "a4",
    "comentario_geral": "Na indicação de hora exata, \"uma hora\" leva crase (\"à uma hora\"), pois \"uma\" é numeral e a hora determinada admite artigo. Para tempo já decorrido usa-se o verbo \"haver\" (\"há cerca de dez dias\"). Para tempo futuro, com \"daqui\", usa-se apenas a preposição \"a\", sem artigo (\"daqui a duas semanas\").",
    "analise_alternativas": [
      {
        "id": "a1",
        "correta": false,
        "justificativa": "Erra a primeira lacuna (hora exata pede \"à uma hora\") e a última (\"daqui a duas semanas\" não tem artigo, logo não tem crase)."
      },
      {
        "id": "a2",
        "correta": false,
        "justificativa": "Erra as duas últimas lacunas: tempo passado se indica com \"há\", e tempo futuro com a preposição \"a\"."
      },
      {
        "id": "a3",
        "correta": false,
        "justificativa": "\"Há\" não indica hora do relógio, e \"à cerca de\" não se aplica a tempo decorrido; a ordem correta é outra."
      },
      {
        "id": "a4",
        "correta": true,
        "justificativa": "\"À uma hora\" (hora exata), \"há cerca de dez dias\" (tempo decorrido) e \"daqui a duas semanas\" (tempo futuro)."
      }
    ],
    "fundamento_legal": "não se aplica",
    "fundamento_jurisprudencial": "não se aplica",
    "observacao_temporal": "não se aplica",
    "pegadinha": "Confundir \"à\" (hora exata), \"há\" (tempo passado) e \"a\" (tempo futuro ou distância).",
    "lei_referencia": "não se aplica",
    "macete_do_riccardo": "Tempo que já passou: \"há\" (dá para trocar por \"faz\"). Tempo que vai chegar: \"daqui a\". Hora do relógio: \"à\" ou \"às\".",
    "fique_ligado": null,
    "cuidado_na_prova": null,
    "tipo_cobranca": "comparacao",
    "exigencia_cognitiva": "aplicacao",
    "palavras_chave": [
      "crase",
      "à uma hora",
      "há",
      "daqui a",
      "tempo decorrido"
    ],
    "cita_jurisprudencia": false,
    "status_gerador": "VALIDADA",
    "ressalvas": null,
    "fontes_consultadas": [
      "Conhecimento consolidado da norma-padrão da língua portuguesa (não há texto legal para este tema)"
    ]
  }
]

## Texto legal fornecido
Não há texto legal para este tema (disciplina sem lei de referência). Use conhecimento consolidado e incontroverso da norma-padrão.
