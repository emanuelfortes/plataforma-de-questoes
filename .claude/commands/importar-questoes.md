---
description: Ajuda a converter um banco de questões para o formato JSONL e importar
argument-hint: "[caminho do arquivo de origem]"
---

Arquivo de origem: $ARGUMENTS

1. Leia `docs/FORMATO-QUESTOES.md`, `src/lib/formato-jsonl.ts` e `data/catalogo.json` (mapa oficial de matérias e áreas: a importação recusa nomes fora dele). Se a origem for um PDF de conteúdo para gerar questões novas, use `docs/PROMPT-GERAR-QUESTOES.md` em vez de um conversor.
2. Abra uma amostra do arquivo de origem (primeiras linhas ou registros) e mapeie cada campo para o formato oficial, inclusive disciplina e assunto para os nomes do catálogo e o nível (`facil`, `medio`, `dificil`) quando houver. Mostre o mapeamento ao usuário e confirme antes de seguir quando algo for ambíguo (ex.: gabarito em número em vez de letra, alternativas em colunas separadas, HTML no enunciado).
3. Escreva um conversor em `scripts/converter-<nome>.ts` que leia em streaming (não carregue o arquivo inteiro na memória) e grave `data/<nome>.jsonl`.
4. Rode o conversor numa amostra pequena, confira com `npm run importar -- data/<nome>.jsonl --verificar`, depois importe no banco local e mostre o resumo e as primeiras linhas de `data/erros-importacao.log`.
5. Só depois de 0 inválidas (ou inválidas explicadas) sugira a importação completa no Turso.
