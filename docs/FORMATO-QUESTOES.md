# Formato do arquivo de importação

Arquivo **JSON Lines** (`.jsonl`): um objeto JSON por linha, codificação UTF-8.
Não use um único JSON com um array gigante: com 1 milhão de itens ele não cabe na memória.
O validador está em `src/lib/formato-jsonl.ts`.

## Questão de múltipla escolha

```json
{"tipo":"multipla","id":"q_0000001","disciplina":"Língua Portuguesa","assunto":"Crase","banca":"FGV","ano":2024,"enunciado":"Assinale a alternativa em que o uso da crase está correto.","alternativas":[{"letra":"A","texto":"Fui à pé."},{"letra":"B","texto":"Entreguei o livro à ela."},{"letra":"C","texto":"Chegamos à cidade cedo."},{"letra":"D","texto":"Começou à chover."},{"letra":"E","texto":"Vendemos à prazo."}],"gabarito":"C","comentario":"Há crase antes de palavra feminina que admite artigo: chegar a + a cidade."}
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `tipo` | sim | `"multipla"` |
| `id` | sim | único em todo o banco. Reimportar o mesmo `id` não duplica nem sobrescreve |
| `disciplina` | sim | nome exato. Disciplinas são criadas automaticamente |
| `assunto` | não | criado automaticamente dentro da disciplina |
| `banca` | não | texto livre |
| `ano` | não | inteiro entre 1900 e 2100 |
| `enunciado` | sim | texto; quebras de linha com `\n` |
| `alternativas` | sim | de 2 a 6 itens `{ "letra": "A", "texto": "..." }`, letras maiúsculas sem repetir |
| `gabarito` | sim | letra que existe em `alternativas` |
| `comentario` | não | explicação mostrada depois da resposta |

### Certo ou Errado (estilo Cebraspe)

Use duas alternativas:

```json
{"tipo":"multipla","id":"q_0000002","disciplina":"Direito Constitucional","banca":"CEBRASPE","ano":2023,"enunciado":"Julgue o item: ...","alternativas":[{"letra":"C","texto":"Certo"},{"letra":"E","texto":"Errado"}],"gabarito":"E"}
```

## Flashcard

```json
{"tipo":"flashcard","id":"f_0000001","disciplina":"Língua Portuguesa","assunto":"Crase","frente":"Quando a crase é proibida?","verso":"Antes de verbo, de palavra masculina e de pronomes pessoais."}
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `tipo` | sim | `"flashcard"` |
| `id` | sim | único entre os flashcards |
| `disciplina` | sim | |
| `assunto` | não | |
| `frente`, `verso` | sim | texto |

Questões e flashcards podem estar no mesmo arquivo, misturados.

## Importando

```bash
npm run importar -- data/meu-banco.jsonl
```

- Linhas inválidas não param a importação: vão para `data/erros-importacao.log` com o número da linha e o motivo.
- No fim, a tabela `contagens` é recalculada automaticamente.
- Arquivos `.jsonl` grandes ficam fora do git (veja `.gitignore`).
