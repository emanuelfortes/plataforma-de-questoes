# Pedido de geração: lote crase-01

## Parâmetros da produção
- Disciplina: Língua Portuguesa
- Tema: Crase
- Subtemas do tema: não especificados
- Foco deste lote (não saia dele): Regra geral (preposição a + artigo a) e casos em que a crase é proibida (antes de verbo, palavra masculina, pronomes pessoais, de tratamento e indefinidos, expressões com palavras repetidas).
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
- Tamanho: hoje a correta é a 1ª mais longa (99 caracteres; média das erradas 79). Reescreva as alternativas para que a correta fique na posição 1 do ranking de tamanho (1 = a mais longa) e no máximo 25% acima da média das erradas. Prefira enriquecer os distratores com detalhes plausíveis do mesmo nível (prazos, condições, remissões) a cortar informação da correta, e não mude o que torna cada alternativa certa ou errada.
- Mantenha o mesmo id_correta e os mesmos ids de alternativas.

### q08
- Tamanho: hoje a correta é a 1ª mais longa (10 caracteres; média das erradas 10). Reescreva as alternativas para que a correta fique na posição 4 do ranking de tamanho (1 = a mais longa) e no máximo 25% acima da média das erradas. Prefira enriquecer os distratores com detalhes plausíveis do mesmo nível (prazos, condições, remissões) a cortar informação da correta, e não mude o que torna cada alternativa certa ou errada.
- Mantenha o mesmo id_correta e os mesmos ids de alternativas.

### q10
- Tamanho: hoje a correta é a 1ª mais longa (137 caracteres; média das erradas 92). Reescreva as alternativas para que a correta fique na posição 1 do ranking de tamanho (1 = a mais longa) e no máximo 25% acima da média das erradas. Prefira enriquecer os distratores com detalhes plausíveis do mesmo nível (prazos, condições, remissões) a cortar informação da correta, e não mude o que torna cada alternativa certa ou errada.
- Mantenha o mesmo id_correta e os mesmos ids de alternativas.

## Questões atuais (JSON)
[
  {
    "id": "q04",
    "tema": "Crase",
    "subtema": "Crase proibida antes de pronomes de tratamento, pessoais e indefinidos",
    "dificuldade": "media",
    "enunciado": "Assinale a frase em que o emprego ou a ausência do acento grave está de acordo com a norma-padrão.",
    "alternativas": [
      {
        "id": "a1",
        "texto": "O comissário dirigiu-se a Sua Excelência, o secretário da Segurança Pública, com o devido respeito."
      },
      {
        "id": "a2",
        "texto": "O relatório final será entregue à Vossa Senhoria na próxima segunda-feira."
      },
      {
        "id": "a3",
        "texto": "O delegado recomendou atenção à qualquer testemunha que se apresentasse espontaneamente."
      },
      {
        "id": "a4",
        "texto": "A inspetora pediu explicações à ela sobre o horário em que deixou o local."
      }
    ],
    "id_correta": "a1",
    "comentario_geral": "Pronomes de tratamento como Vossa Senhoria, Vossa Excelência e Sua Excelência não admitem artigo; por isso, mesmo depois de um termo que exige a preposição \"a\", não há crase. O mesmo vale para pronomes pessoais (ela) e para pronomes indefinidos como \"qualquer\". A única frase correta é a que traz \"dirigiu-se a Sua Excelência\", sem acento grave.",
    "analise_alternativas": [
      {
        "id": "a1",
        "correta": true,
        "justificativa": "Correta: \"dirigir-se\" exige a preposição \"a\", mas \"Sua Excelência\" é pronome de tratamento e não aceita artigo; logo, apenas preposição, sem crase."
      },
      {
        "id": "a2",
        "correta": false,
        "justificativa": "Incorreta: \"Vossa Senhoria\" é pronome de tratamento e não admite artigo. O correto é \"entregue a Vossa Senhoria\"."
      },
      {
        "id": "a3",
        "correta": false,
        "justificativa": "Incorreta: \"qualquer\" é pronome indefinido e não é precedido de artigo. O correto é \"atenção a qualquer testemunha\"."
      },
      {
        "id": "a4",
        "correta": false,
        "justificativa": "Incorreta: \"ela\" é pronome pessoal e não admite artigo. O correto é \"pediu explicações a ela\"."
      }
    ],
    "fundamento_legal": "Não se aplica: disciplina sem lei de referência. Regra da norma-padrão: não ocorre crase antes de pronomes de tratamento iniciados por Vossa ou Sua, de pronomes pessoais e de pronomes indefinidos como \"qualquer\".",
    "fundamento_jurisprudencial": "não se aplica",
    "observacao_temporal": "não se aplica",
    "pegadinha": "Supor que o caráter formal do pronome de tratamento ou o fato de se referir a uma mulher autoriza o acento grave.",
    "lei_referencia": "não se aplica",
    "macete_do_riccardo": null,
    "fique_ligado": null,
    "cuidado_na_prova": "A regra vale para os pronomes de tratamento com Vossa e Sua. Não estenda essa proibição automaticamente a palavras como \"senhora\" ou \"dona\", que seguem outro tratamento na gramática.",
    "tipo_cobranca": "comparacao",
    "exigencia_cognitiva": "aplicacao",
    "palavras_chave": [
      "crase",
      "pronome de tratamento",
      "pronome pessoal",
      "pronome indefinido",
      "Vossa Senhoria"
    ],
    "cita_jurisprudencia": false,
    "status_gerador": "VALIDADA",
    "ressalvas": null,
    "fontes_consultadas": [
      "Conhecimento consolidado da norma-padrão da língua portuguesa (não há texto legal fornecido no contexto)"
    ]
  },
  {
    "id": "q08",
    "tema": "Crase",
    "subtema": "Regra geral combinada com crase proibida antes de verbo e de pronome de tratamento",
    "dificuldade": "dificil",
    "enunciado": "Leia o trecho a seguir.\n\n\"O inspetor dirigiu-se ___ vítima e comunicou-lhe que, ___ partir daquele momento, as diligências seriam reforçadas; em seguida, entregou o termo de declarações ___ Sua Excelência, o juiz plantonista, e voltou ___ delegacia.\"\n\nAssinale o que preenche corretamente, na ordem, as lacunas do trecho.",
    "alternativas": [
      {
        "id": "a1",
        "texto": "à, a, a, à"
      },
      {
        "id": "a2",
        "texto": "à, à, a, à"
      },
      {
        "id": "a3",
        "texto": "a, a, à, à"
      },
      {
        "id": "a4",
        "texto": "à, a, à, a"
      }
    ],
    "id_correta": "a1",
    "comentario_geral": "Primeira lacuna: \"dirigir-se\" exige a preposição \"a\" e \"vítima\" é feminino com artigo, logo \"à vítima\". Segunda: \"partir\" é verbo, e antes de verbo não há crase (\"a partir de\"). Terceira: \"Sua Excelência\" é pronome de tratamento e não admite artigo, então \"a Sua Excelência\". Quarta: \"voltar\" pede a preposição \"a\" e \"delegacia\" é feminino com artigo (voltou ao distrito, voltou à delegacia). A sequência é à, a, a, à.",
    "analise_alternativas": [
      {
        "id": "a1",
        "correta": true,
        "justificativa": "Aplica corretamente as quatro regras: crase em \"à vítima\" e \"à delegacia\"; sem crase antes do verbo \"partir\" e antes do pronome de tratamento \"Sua Excelência\"."
      },
      {
        "id": "a2",
        "correta": false,
        "justificativa": "Erra a segunda lacuna: na locução \"a partir de\", o \"a\" antecede verbo e não pode receber acento grave."
      },
      {
        "id": "a3",
        "correta": false,
        "justificativa": "Erra a primeira lacuna, pois omite a crase obrigatória em \"dirigiu-se à vítima\", e a terceira, pois acentua o \"a\" diante de pronome de tratamento."
      },
      {
        "id": "a4",
        "correta": false,
        "justificativa": "Erra a terceira lacuna (pronome de tratamento não admite artigo) e a quarta, pois \"voltou à delegacia\" exige crase."
      }
    ],
    "fundamento_legal": "Não se aplica: disciplina sem lei de referência. Regra da norma-padrão: crase como fusão de preposição e artigo feminino; proibição antes de verbo e de pronome de tratamento.",
    "fundamento_jurisprudencial": "não se aplica",
    "observacao_temporal": "não se aplica",
    "pegadinha": "Acentuar o \"a\" da locução \"a partir de\" e o \"a\" diante de \"Sua Excelência\" por proximidade com palavras femininas.",
    "lei_referencia": "não se aplica",
    "macete_do_riccardo": null,
    "fique_ligado": "\"A partir de\" nunca tem acento grave: o \"a\" está diante do verbo \"partir\".",
    "cuidado_na_prova": null,
    "tipo_cobranca": "aplicacao_pratica",
    "exigencia_cognitiva": "analise",
    "palavras_chave": [
      "crase",
      "a partir de",
      "pronome de tratamento",
      "regra geral",
      "preenchimento de lacunas"
    ],
    "cita_jurisprudencia": false,
    "status_gerador": "VALIDADA",
    "ressalvas": null,
    "fontes_consultadas": [
      "Conhecimento consolidado da norma-padrão da língua portuguesa (não há texto legal fornecido no contexto)"
    ]
  },
  {
    "id": "q10",
    "tema": "Crase",
    "subtema": "Regra geral e casos de crase proibida em texto",
    "dificuldade": "dificil",
    "enunciado": "Leia o texto a seguir.\n\n\"Logo ao amanhecer, a equipe chegou (1) à residência indicada na denúncia. Os agentes começaram (2) a vasculhar o quintal, palmo (3) a palmo, até que um vizinho se dirigiu (4) a eles e prestou informações (5) à equipe.\"\n\nSobre o emprego do sinal indicativo de crase nas ocorrências numeradas, é correto afirmar que:",
    "alternativas": [
      {
        "id": "a1",
        "texto": "em (2), o acento grave seria obrigatório, pois o verbo \"começar\" exige a preposição \"a\"."
      },
      {
        "id": "a2",
        "texto": "em (1) e (5), o acento grave resulta da fusão da preposição exigida pelo termo regente com o artigo feminino que determina o substantivo."
      },
      {
        "id": "a3",
        "texto": "em (3), deveria haver acento grave, pois a expressão indica modo e é formada por substantivos."
      },
      {
        "id": "a4",
        "texto": "em (4), o acento grave seria facultativo, já que o pronome \"eles\" retoma substantivo do texto."
      }
    ],
    "id_correta": "a2",
    "comentario_geral": "Em (1), \"chegar\" exige a preposição \"a\" e \"residência\" é feminino com artigo: à residência. Em (5), \"prestar informações\" pede complemento introduzido por \"a\" e \"equipe\" é feminino com artigo: à equipe. Nos demais pontos não pode haver crase: em (2), o \"a\" antecede verbo; em (3), a expressão é formada por palavras repetidas e masculinas; em (4), o \"a\" antecede pronome pessoal, que não admite artigo.",
    "analise_alternativas": [
      {
        "id": "a1",
        "correta": false,
        "justificativa": "Embora \"começar\" peça a preposição, o termo seguinte é o verbo \"vasculhar\", que não admite artigo; portanto não há crase."
      },
      {
        "id": "a2",
        "correta": true,
        "justificativa": "Correta: nas duas ocorrências há preposição exigida pelo termo regente (chegar a; prestar informações a) e artigo feminino diante de \"residência\" e \"equipe\"."
      },
      {
        "id": "a3",
        "correta": false,
        "justificativa": "\"Palmo a palmo\" é expressão com palavras repetidas e masculinas; o \"a\" é só preposição e não recebe acento grave."
      },
      {
        "id": "a4",
        "correta": false,
        "justificativa": "Antes de pronome pessoal a crase é proibida, não facultativa; \"eles\", além disso, é masculino."
      }
    ],
    "fundamento_legal": "Não se aplica: disciplina sem lei de referência. Regra da norma-padrão: crase como fusão de preposição e artigo feminino; proibição antes de verbo, de pronome pessoal, de palavra masculina e entre palavras repetidas.",
    "fundamento_jurisprudencial": "não se aplica",
    "observacao_temporal": "não se aplica",
    "pegadinha": "Confundir a exigência de preposição pelo verbo (começar a) com a ocorrência de crase, que também depende do artigo feminino.",
    "lei_referencia": "não se aplica",
    "macete_do_riccardo": null,
    "fique_ligado": null,
    "cuidado_na_prova": null,
    "tipo_cobranca": "interpretacao",
    "exigencia_cognitiva": "analise",
    "palavras_chave": [
      "crase",
      "regra geral",
      "crase antes de verbo",
      "pronome pessoal",
      "palavras repetidas",
      "análise de texto"
    ],
    "cita_jurisprudencia": false,
    "status_gerador": "VALIDADA",
    "ressalvas": null,
    "fontes_consultadas": [
      "Conhecimento consolidado da norma-padrão da língua portuguesa (não há texto legal fornecido no contexto)"
    ]
  }
]

## Texto legal fornecido
Não há texto legal para este tema (disciplina sem lei de referência). Use conhecimento consolidado e incontroverso da norma-padrão.
