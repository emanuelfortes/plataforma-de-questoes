# Alimentar a plataforma com questões geradas por IA

O dono transforma um PDF de conteúdo (apostila, resumo, lei, capítulo de livro) em questões e flashcards, sem terminal e sem programação, pela **área do dono** em `/admin`.

## Quem acessa

Os e-mails da variável `ADMIN_EMAILS` (separados por vírgula), na Vercel e no `.env.local`. A pessoa cria a conta normalmente no site com esse e-mail e passa a ver o link **Admin** no menu. Para os demais, `/admin` responde "página não encontrada".

## Passo a passo (na tela /admin)

1. **Gerar o prompt.** Escolha as quantidades (fáceis, médias, difíceis, flashcards) e o formato. Clique em **Copiar prompt**.
   O prompt serve para **qualquer matéria**: a IA lê o PDF e identifica sozinha a matéria e as áreas (tópicos de edital). A opção "Mostrar à IA as matérias e áreas que já existem" (ligada por padrão) não limita nada, só faz a IA repetir o mesmo nome quando o PDF tratar de um tema que já existe.
2. **Mandar para a IA.** Conversa nova no Claude, ChatGPT ou Gemini, anexe o PDF, cole o prompt. Ela devolve um arquivo `.json` (ou um bloco de código json, se não puder criar arquivos).
3. **Importar.** Envie o arquivo (ou cole o texto) e clique em **Conferir**. A tela mostra, sem gravar nada:
   - quantas questões e flashcards são novos, quantos já existiam e quantos têm problema (com o motivo de cada um);
   - a divisão por área e nível;
   - as matérias e áreas que vão ser criadas, com aviso quando uma "parece com" outra que já existe;
   - os pontos cobertos (guarde para o próximo lote) e uma amostra das questões.
   Confira e clique em **Importar**. As questões entram na hora para os alunos.
4. **Revise por amostragem.** A IA erra às vezes: resolva algumas questões de cada lote.

### Mais questões do mesmo PDF

Na mesma conversa com a IA:

> Gere outro lote no mesmo formato, priorizando os pontos com menos questões, sem repetir enunciados, exemplos ou frases das questões anteriores.

Em outro dia, gere o prompt de novo e cole no campo "Pontos já cobertos" a lista que a conferência mostrou.

Peça no máximo umas 30 questões por resposta: acima disso a IA tende a repetir e errar o formato.

## Como o conteúdo fica organizado e sem repetição

- **Nomes padronizados:** matérias e áreas vêm do PDF (não há lista fechada), mas nomes equivalentes viram um só (maiúsculas, acentos, plural, "de/da/do"). `data/catalogo.json` tem os nomes preferidos e apelidos ("Português" vira "Língua Portuguesa").
- **Mapa de pontos:** o prompt obriga a IA a listar os pontos do PDF e espalhar as questões por todos antes de repetir um. É o que evita conteúdo repetitivo dentro de um lote.
- **Impressão digital:** a mesma questão importada duas vezes (de dois PDFs, ou do mesmo arquivo) entra uma vez só.
- **Níveis:** fácil, médio e difícil ficam guardados para equilibrar o conteúdo. O aluno não escolhe nível: as questões aparecem embaralhadas, como na prova.
- **Sem banca e sem ano:** questão inédita não caiu em prova; marcar "FGV 2023" enganaria o aluno.

## Para o desenvolvedor

- Texto do prompt: `src/lib/prompt-ia.ts` (`montarPrompt`).
- Leitura e validação do arquivo: `src/db/importacao.ts` (`lerArquivo`, `prepararItem`, `criarGravador`). É o mesmo código do `npm run importar`, que também aceita o `.json` do prompt:
  ```bash
  npm run importar -- data/questoes.json --verificar
  npm run importar -- data/questoes.json
  ```
- Formato aceito: `docs/FORMATO-QUESTOES.md`.
