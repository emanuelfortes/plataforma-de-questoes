# Erro registrado: questões que só cobram pena

Leia este documento antes de gerar questões para a plataforma Riccardo Nóbrega. Ele explica um erro que já aconteceu, quanto custou corrigir e as regras para não repetir. Se for gerar questões num chat do Claude, cole este documento junto com o prompt de `docs/PROMPT-CLAUDE-QUESTOES.md`. O prompt já traz essas regras; este documento explica o porquê.

## O que aconteceu

Em outubro de 2026, cerca de 2.400 questões foram geradas numa conversa do Claude sem o prompt da plataforma e importadas no site. Nas matérias penais, quase 4 em cada 10 questões giravam em torno da **quantidade de pena** ("reclusão de 2 a 4 anos", "aumentada de um terço", "em dobro").

| Matéria | Questões focadas em pena |
|---|---|
| Direito Penal | 39% |
| Legislação Penal Especial | 29% |
| Direito Penal Militar | 38% |

Os alunos reclamaram. A banca quase não cobra pena: ninguém decora pena, e a prova cobra principalmente **qual crime se configura**. Foi preciso reescrever 212 questões (177 importadas e 35 geradas pela plataforma), auditar cada uma e atualizar o site. Hoje a taxa está em cerca de 10%.

## Como o erro aparece

**Errado (pena como tema da questão):**

> João subtraiu, mediante grave ameaça, o celular de Maria. Qual a pena prevista para o crime praticado?
> A) Reclusão, de 1 a 4 anos, e multa.
> B) Reclusão, de 4 a 10 anos, e multa.
> C) Detenção, de 6 meses a 2 anos.
> D) Reclusão, de 2 a 8 anos.

**Errado (pena colada no nome do crime, mesmo quando a pergunta é outra):**

> Qual crime João praticou?
> A) Furto qualificado, com pena de reclusão de 2 a 8 anos.
> B) Roubo, com pena de reclusão de 4 a 10 anos.
> ...

**Certo (cobra o crime e a distinção entre crimes parecidos):**

> João subtraiu, mediante grave ameaça, o celular de Maria. Logo depois, foi preso a duas quadras do local, sem ter tido a posse tranquila do aparelho. Assinale a alternativa correta.
> A) Houve furto consumado, pois a ameaça não integra o tipo do art. 155 do CP.
> B) Houve roubo consumado, pois basta a inversão da posse, ainda que breve e não mansa.
> C) Houve roubo tentado, pois João não chegou a ter a posse tranquila do bem.
> D) Houve extorsão, pois a vítima entregou o bem diante da ameaça.

## Regras para não repetir

1. **No máximo 1 em cada 10 questões** pode ter a quantidade de pena como foco. Num lote de 5 a 10 questões, no máximo 1.
2. Conta como "focada em pena" a questão em que **2 ou mais alternativas** trazem quantidade de pena (anos, meses, fração de aumento, "em dobro", "triplo").
3. Nas outras questões, cobre: qual crime se configura, os elementos do tipo, consumação e tentativa, a hipótese de qualificadora ou causa de aumento (sem a fração), as exceções, a ação penal e a diferença entre crimes parecidos.
4. Quando a pergunta for "qual crime" ou "como se tipifica", as alternativas trazem **só o nome do crime**, sem pena.
5. Exceção legítima: no assunto "Penas", "Aplicação da pena" ou "Prescrição", a pena é o próprio conteúdo, e a regra 1 não se aplica.
6. Processo Penal e Direito Constitucional não entram nessa conta (prazo e quórum não são pena).

## Outros erros que já aconteceram (evite também)

- **A correta é a mais longa.** A alternativa correta deve ter de 0,8 a 1,25 vezes o tamanho médio das erradas. Num grupo de 10, ela é a mais longa em no máximo 3 e a mais curta em no máximo 3.
- **Palavras absolutas só nas erradas** ("sempre", "nunca", "jamais", "em qualquer hipótese", "automaticamente"). O aluno acerta sem saber. As erradas devem errar pelo conteúdo.
- **Artigo com decisão do STF sem nota.** Se o artigo teve inconstitucionalidade declarada, interpretação conforme ou não recepção (lista em `data/dispositivos-sensiveis.json`), o comentário precisa explicar isso. Sem a nota, a questão fica retida.
- **Citar letra no comentário** ("a alternativa B está errada"). As letras são embaralhadas no site. Explique pelo conteúdo.
- **Inventar número de súmula ou julgado.** Só cite julgados que estão em `data/jurisprudencia.json`.

## Como conferir antes de subir

- **No site:** o importador em /admin > Questões avisa quando o arquivo vem com pena demais ou com a correta sempre a mais longa. Se aparecer o aviso, não importe. Peça para a IA refazer as questões apontadas.
- **Na produção automática** (`/gerar-lote`): a checagem `cobraPena` em `src/lib/qualidade.ts` e `scripts/questoes/esquema.ts` já barra o lote. O relatório da noite mostra a taxa de pena por matéria.
- **Para medir o que já está no ar:** `npx tsx scripts/publicacao/pena.ts listar` lista as questões focadas em pena por matéria.
