# Formato do arquivo de importação

Arquivo **JSON Lines** (`.jsonl`): um objeto JSON por linha, codificação UTF-8.
Não use um único JSON com um array gigante: com 1 milhão de itens ele não cabe na memória.
O validador está em `src/lib/formato-jsonl.ts`.

Para gerar questões a partir de um PDF com IA e importar pela tela do dono (`/admin`), veja `docs/PROMPT-GERAR-QUESTOES.md`.

## Formatos aceitos

1. **JSON Lines** (`.jsonl`): um objeto por linha, com `tipo` em cada um (detalhado abaixo). Use para bancos grandes (o script lê em streaming).
2. **JSON do prompt de IA** (`.json`): um objeto com a matéria uma vez só e as listas separadas. Os itens usam `area` (sinônimo de `assunto`) e não precisam de `tipo` nem `disciplina`:
   ```json
   {"disciplina":"Língua Portuguesa","pontos_cobertos":[{"area":"Crase","ponto":"...","questoes":2}],"areas_sugeridas":[],
    "questoes":[{"area":"Crase","dificuldade":"medio","enunciado":"...","alternativas":[{"letra":"A","texto":"..."},{"letra":"B","texto":"..."}],"gabarito":"B","comentario":"..."}],
    "flashcards":[{"area":"Crase","frente":"...","verso":"..."}]}
   ```
   `pontos_cobertos` e `areas_sugeridas` só aparecem na conferência; não são gravados.
3. **Array JSON** de itens no formato JSON Lines.

Desvios comuns das IAs são corrigidos antes de validar: cercas ```json, letra e gabarito minúsculos, nível com acento ("Médio"), nome de matéria ou área com grafia diferente da já cadastrada.

## Matérias e áreas

Toda questão e todo flashcard pertencem a uma **disciplina** (matéria) e, de preferência, a um **assunto** (área específica dentro dela, como "Substantivo" em Língua Portuguesa).
**Não é uma lista fechada:** matérias e áreas novas são criadas na importação (a IA as identifica pelo PDF). Para não virar bagunça:

- Nomes equivalentes viram um só: maiúsculas, acentos, plural, pontuação e "de/da/do" são ignorados na comparação ("Substantivos" entra em "Substantivo"; "direito penal" entra em "Direito Penal").
- `data/catalogo.json` guarda os nomes **preferidos** e apelidos de matérias ("Português" vira "Língua Portuguesa", "RLM" vira "Raciocínio Lógico").
- Na tela do dono, a conferência lista o que vai ser criado e avisa quando uma área nova "parece com" uma existente.

## Questão de múltipla escolha

```json
{"tipo":"multipla","disciplina":"Língua Portuguesa","assunto":"Crase","dificuldade":"medio","enunciado":"Assinale a alternativa em que o uso da crase está correto.","alternativas":[{"letra":"A","texto":"Fui à pé."},{"letra":"B","texto":"Entreguei o livro à ela."},{"letra":"C","texto":"Chegamos à cidade cedo."},{"letra":"D","texto":"Começou à chover."},{"letra":"E","texto":"Vendemos à prazo."}],"gabarito":"C","comentario":"Há crase antes de palavra feminina que admite artigo: chegar a + a cidade."}
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `tipo` | sim | `"multipla"` |
| `id` | não | identificador único. Sem `id`, o sistema cria um a partir do conteúdo (veja "Repetições") |
| `disciplina` | sim | nome da matéria; nova é criada, equivalente reaproveita a existente |
| `assunto` | não, mas recomendado | área dentro da disciplina (também aceita o nome `area`) |
| `dificuldade` | não, mas recomendado | `"facil"`, `"medio"` ou `"dificil"` (sem acento) |
| `banca` | não | só para questões de prova real. Questão inédita (feita por professor ou IA) fica sem banca |
| `ano` | não | inteiro entre 1900 e 2100; só para questões de prova real |
| `enunciado` | sim | texto; quebras de linha com `\n` |
| `alternativas` | sim | de 2 a 6 itens `{ "letra": "A", "texto": "..." }`, letras maiúsculas sem repetir |
| `gabarito` | sim | letra que existe em `alternativas` |
| `comentario` | não | explicação mostrada depois da resposta, em partes (veja abaixo) |

### Comentário em partes

A tela separa o comentário pelos rótulos abaixo, cada um em linha nova (`\n`). Sem rótulo, o texto aparece corrido.

1. Primeiro, sem rótulo: 2 a 4 frases explicando o ponto cobrado.
2. `Análise das alternativas:` e, uma por linha, `A) Errada: ...`, `B) Correta: ...`. O trecho que deixa a errada errada vai entre `~~ ~~` e aparece riscado.
3. `Fundamento legal:` com o artigo e a lei (ex.: `CP, art. 157, § 2º, I`). Aparece num quadro de letra de lei, e é por ele que a questão fica ligada ao artigo no Vade Mecum.
4. Opcional: `Pegadinha:` ou `Macete:`, que aparecem como aviso.

Fora da análise, não cite letras ("a alternativa B..."): o importador pode trocar a ordem das alternativas para equilibrar o gabarito, e as letras da análise são trocadas junto.

### Níveis

| Nível | O que cobra |
|---|---|
| `facil` | um único ponto, de forma direta: definição, regra geral, exemplo clássico |
| `medio` | aplicação da regra a um caso novo; distinguir conceitos parecidos |
| `dificil` | combinação de pontos, exceções, casos-limite e pegadinhas típicas de banca |

As questões aparecem embaralhadas (cada uma recebe uma posição sorteada na importação), então fácil, médio e difícil vêm misturados, como na prova. O aluno pode filtrar por nível em **Opções** na tela de filtro; dentro da questão, o nível só aparece depois que ele responde.

### Certo ou Errado (estilo Cebraspe)

Use duas alternativas:

```json
{"tipo":"multipla","disciplina":"Direito Constitucional","assunto":"Direitos e Garantias Fundamentais","dificuldade":"dificil","enunciado":"Julgue o item: ...","alternativas":[{"letra":"C","texto":"Certo"},{"letra":"E","texto":"Errado"}],"gabarito":"E"}
```

## Flashcard

```json
{"tipo":"flashcard","disciplina":"Língua Portuguesa","assunto":"Crase","frente":"Quando a crase é proibida?","verso":"Antes de verbo, de palavra masculina e de pronomes pessoais."}
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `tipo` | sim | `"flashcard"` |
| `id` | não | único entre os flashcards. Sem `id`, o sistema cria um a partir da frente |
| `disciplina` | sim | nome da matéria |
| `assunto` | não, mas recomendado | área dentro da matéria |
| `frente`, `verso` | sim | texto |

Questões e flashcards podem estar no mesmo arquivo, misturados.

## Repetições

- **Com `id`:** reimportar o mesmo `id` não duplica nem sobrescreve.
- **Sem `id`:** o código é uma impressão digital do conteúdo (disciplina, enunciado e alternativas; no flashcard, disciplina e frente), ignorando maiúsculas, acentos e espaços. A mesma questão vinda de dois PDFs diferentes entra **uma vez só**. No resumo da importação ela aparece em "já existiam".
- Questões parecidas mas não idênticas (mesmo ponto, outras palavras) não são detectadas aqui: evite-as na geração (o prompt de IA trata disso com o "mapa de pontos").

## Importando

```bash
npm run importar -- data/meu-arquivo.jsonl --verificar   # só confere, não grava nada
npm run importar -- data/meu-arquivo.jsonl               # importa de verdade
```

- Linhas inválidas não param a importação: vão para `data/erros-importacao.log` com o número da linha e o motivo.
- No fim, a tabela `contagens` é recalculada automaticamente.
- Arquivos `.jsonl` grandes ficam fora do git (veja `.gitignore`).
