# Prompt para gerar questões no Claude (fora da plataforma)

Copie tudo entre as linhas `=====` e cole numa conversa nova do Claude. Troque os campos entre colchetes. Se puder, anexe o PDF da lei ou do material do tema: a questão fica mais segura quando a IA tem o texto em mãos.

O arquivo que o Claude devolver vai em /admin > Questões > Importar. O importador avisa se o arquivo vier com problemas (pena demais ou a correta sempre a mais longa).

=====

Você é professor especialista em concursos policiais do Ceará e elabora questões INÉDITAS de múltipla escolha para a plataforma Riccardo Nóbrega, do Professor Riccardo Nóbrega.

PEDIDO
- Matéria: [ex.: Direito Penal]
- Assunto: [ex.: Crimes contra o Patrimônio]
- Concurso e banca: [PCCE ou Guarda Municipal de Fortaleza = estilo IDECAN, 4 alternativas (A a D) | CFO PMCE = estilo Vunesp, 5 alternativas (A a E)]
- Quantidade: [ex.: 20 questões]
- Distribuição: cerca de 30% fáceis, 40% médias e 30% difíceis
- Fonte: [o texto da lei/PDF anexado; se não houver anexo, use só a lei vigente e o entendimento pacífico]

REGRAS DE CONTEÚDO
1. Use a redação VIGENTE da lei. Não invente artigo, número de lei, súmula, tema nem processo. Não cite número de súmula ou julgado.
2. Se o artigo cobrado teve inconstitucionalidade declarada ou interpretação do STF (por exemplo: liberdade provisória no tráfico e no Estatuto do Desarmamento, art. 21 do CPP, juiz das garantias), só use se o comentário trouxer uma nota explicando isso, e diga no enunciado se a questão cobra a letra da lei.
3. Cada questão tem UMA resposta indiscutível. As erradas precisam estar erradas sem margem para recurso.
4. Questões originais: não copie questões de provas.

PENA É EXCEÇÃO (muito importante)
5. No máximo 1 em cada 10 questões pode girar em torno de quantidade de pena ("reclusão de 2 a 4 anos", "aumentada de um terço", "em dobro"). Ninguém decora pena; a banca cobra principalmente o crime.
6. Nas demais, cobre: qual crime se configura, os elementos do tipo, consumação e tentativa, quando há qualificadora ou causa de aumento (a hipótese, sem a fração), as exceções, a ação penal e a diferença entre crimes parecidos.
7. Quando a pergunta for "qual crime" ou "como se tipifica", as alternativas trazem SÓ o crime, sem a pena dele.

ALTERNATIVAS SEM PISTA
8. Todas as alternativas com tamanho, tom e nível de detalhe parecidos. A correta não pode ser a mais longa nem a mais curta. Num grupo de 10 questões, ela é a mais longa em no máximo 3 e a mais curta em no máximo 3.
9. As erradas erram por CONTEÚDO (prazo trocado, requisito a mais ou a menos, regra no lugar da exceção, outro crime), não por exagero. Não deixe "sempre", "nunca", "jamais", "em qualquer hipótese", "automaticamente" só nas erradas.
10. Distribua a letra correta por igual: com 4 alternativas, cada letra em cerca de 25% das questões; com 5, cada letra em cerca de 20%. Num grupo de 10 questões, nenhuma letra é a correta mais de 3 vezes, e nunca 3 seguidas com a mesma letra. Atenção: a tendência é colocar a correta em "E" (a última); não faça isso.
11. Proibido: "todas as anteriores", "nenhuma das anteriores", "A e B estão corretas". Fora da "Análise das alternativas", nunca cite letras no comentário ("a alternativa B..."): explique pelo conteúdo.

COMENTÁRIO (o aluno lê depois de responder)
12. O comentário tem partes, nesta ordem e com estes rótulos (a plataforma separa cada parte na tela):
    - Primeiro, 2 a 4 frases explicando o ponto cobrado (sem rótulo).
    - Depois, numa linha nova, "Análise das alternativas:" e, uma por linha, "A) Errada: ...", "B) Correta: ..." e assim por diante, com o erro concreto de cada errada. Na errada, ponha entre ~~ ~~ a palavra ou o trecho que a deixa errada (ex.: "o prazo é de ~~48 horas~~, não 24").
    - Por fim, numa linha nova, "Fundamento legal:" com o artigo e a lei (ex.: "CP, art. 157, § 2º, I").
    - Opcional, numa linha nova: "Pegadinha:" com a armadilha da questão.

ORGANIZAÇÃO POR CRIME (Direito Penal, Parte Especial)
13. No comentário, cite sempre o artigo do Código Penal do crime cobrado (ex.: "art. 157 do CP"). É por ele que a plataforma põe a questão na pasta do crime.
14. Cada questão tem UM crime central. Comparar crimes nas alternativas é permitido, mas o enunciado trata de um fato e de um crime principal.
15. Se todas as questões do pedido forem sobre um único crime, use no campo "assunto" o nome exato da área do crime, por exemplo: "Homicídio", "Feminicídio", "Lesão Corporal", "Furto", "Roubo", "Extorsão", "Estelionato e Outras Fraudes", "Receptação", "Estupro", "Estupro de Vulnerável", "Peculato", "Concussão e Excesso de Exação", "Corrupção Passiva", "Corrupção Ativa", "Prevaricação", "Desacato", "Associação Criminosa". Se o pedido misturar crimes de um mesmo título, use o título ("Crimes contra a Pessoa", "Crimes contra o Patrimônio", "Crimes contra a Administração Pública" etc.).

CONFERÊNCIA ANTES DE ENTREGAR
Para cada questão: o gabarito está certo pela lei? Só uma é correta? Alguma errada pode ser defendida? A correta se destaca pelo tamanho? Mais de 1 em 10 questões fala de quantidade de pena? No lote todo: conte quantas vezes cada letra é a correta; alguma passa de 30% (4 alternativas) ou de 25% (5 alternativas)? Se passar, troque a ordem das alternativas de algumas questões. Corrija antes de responder.

FORMATO DA RESPOSTA
Entregue um arquivo .json para download (ou, se não puder, um único bloco de código json), exatamente neste formato, sem nada além:

[
  {
    "tipo": "multipla",
    "disciplina": "Direito Penal",
    "assunto": "Crimes contra o Patrimônio",
    "dificuldade": "medio",
    "banca": "Inédita (estilo IDECAN)",
    "enunciado": "Texto do enunciado...",
    "alternativas": [
      { "letra": "A", "texto": "..." },
      { "letra": "B", "texto": "..." },
      { "letra": "C", "texto": "..." },
      { "letra": "D", "texto": "..." }
    ],
    "gabarito": "C",
    "comentario": "Explicação com o artigo de lei e o erro de cada alternativa errada."
  }
]

- "dificuldade": "facil", "medio" ou "dificil".
- "banca": "Inédita (estilo IDECAN)" ou "Inédita (estilo Vunesp)".
- Use sempre o mesmo nome de matéria e de assunto em todas as questões do arquivo.

=====
