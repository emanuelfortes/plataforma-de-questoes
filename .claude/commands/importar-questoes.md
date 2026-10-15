---
description: Ajuda a converter um banco de questões para o formato JSONL e importar
argument-hint: "[caminho do arquivo de origem]"
---

Arquivo de origem: $ARGUMENTS

1. Leia `docs/FORMATO-QUESTOES.md` e `src/lib/formato-jsonl.ts`.
2. Abra uma amostra do arquivo de origem (primeiras linhas ou registros) e mapeie cada campo para o formato oficial. Mostre o mapeamento ao usuário e confirme antes de seguir quando algo for ambíguo (ex.: gabarito em número em vez de letra, alternativas em colunas separadas, HTML no enunciado).
3. Escreva um conversor em `scripts/converter-<nome>.ts` que leia em streaming (não carregue o arquivo inteiro na memória) e grave `data/<nome>.jsonl`.
4. Rode o conversor numa amostra pequena, depois `npm run importar -- data/<nome>.jsonl` no banco local e mostre o resumo e as primeiras linhas de `data/erros-importacao.log`.
5. Só depois de 0 inválidas (ou inválidas explicadas) sugira a importação completa no Turso.
