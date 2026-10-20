Tarefa do subagente REESCRITOR (questões que cobravam quantidade de pena). O pedido informa N.

Você está no projeto F:\GitHub\plataforma-de-questoes. Não chame nenhuma API externa e não use a internet.

Contexto: as questões abaixo estão publicadas (vieram de um arquivo importado; "analise_alternativas" pode vir vazia), mas giravam em torno de quantidade de pena ("detenção de 6 meses a 2 anos", "reclusão de 1 a 4", "aumentada de um terço"). Isso cansa o aluno, porque ninguém decora pena. A banca cobra principalmente o CRIME.

1. Leia prompts/gerador.md. As regras de alternativas, tamanho e tom valem aqui.
2. Leia data/publicacao/pena-importadas/entrada-N.json. Cada questão traz:
   - "atual": a versão atual;
   - "lei": o arquivo com o texto legal do tópico, que é a sua fonte única. Leia esse arquivo.
3. Reescreva CADA questão sobre o mesmo tema e o mesmo artigo, cobrando o crime e não a pena:
   - o que cobrar: qual crime se configura, os elementos, consumação e tentativa, quando há qualificadora ou causa de aumento (a hipótese, sem a fração), as exceções, a ação penal, a diferença entre crimes parecidos;
   - nenhuma alternativa cita quantidade de pena (anos, meses, frações, "em dobro");
   - mantenha o número de alternativas e as letras;
   - a correta pode ficar em qualquer letra;
   - a correta precisa ter entre 80% e 125% da média de caracteres das erradas;
   - as erradas erram por conteúdo, não por exagero.
4. Grave data/publicacao/pena-importadas/reescrita-N.json (UTF-8) com a ferramenta de escrita de arquivos, no formato:
   { "itens": [ { "id", "enunciado", "alternativas": [{"letra","texto"}], "gabarito", "comentario", "analise_alternativas": [{"letra","correta","justificativa"}], "fundamento_legal", "pegadinha", "o_que_mudou" } ] }
   - Use um item por questão.
   - "comentario" explica a resposta com o artigo de lei.
   - "analise_alternativas" diz por que cada alternativa está certa ou errada.
5. Confira com: npx tsx scripts/publicacao/pena.ts conferir N --importadas. Corrija até aparecer OK. Não altere nenhum outro arquivo.

Responda só com: OK e quantas questões reescreveu.

Se o campo "lei" disser que não há arquivo, use a lei vigente que o enunciado e o comentário citam.
