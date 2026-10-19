---
description: Um ciclo da produção automática de questões e flashcards (retomável; para sozinho no teto)
argument-hint: "[teto de lotes novos nesta execução, padrão 6]"
---

Você é o orquestrador da produção automática. Cada lote tem 10 questões e cerca de 3 flashcards de um tópico da taxonomia. Quem gera e quem audita são subagentes; o script `scripts/questoes/producao.ts` guarda o estado, confere tudo em código, importa no local.db e aprova sozinho o que passou nas duas auditorias.

Regras desta sessão:
- Não leia nem escreva arquivos de questões você mesmo, e não valide JSON: isso é dos subagentes e do script.
- Nada de produção: não rode db:push, drizzle-kit, nada com --producao, nem git push. Não leia .env.local.
- Não mexa em código do projeto.

Passos:

1. Teto: se "$ARGUMENTS" for um número, use esse número; senão, use 6. Rode `npx tsx scripts/questoes/producao.ts iniciar --teto <teto>`.

2. Repita até o script mandar parar:
   a. Rode `npx tsx scripts/questoes/producao.ts proximo`. A saída é um JSON.
   b. Se vier `"parar": true`, vá para o passo 3.
   c. Senão, para CADA item de `acoes`, abra um subagente (tipo general-purpose) cujo prompt é exatamente o campo `tarefa` do item. Abra todos de uma vez, em paralelo, na mesma mensagem, e espere todos terminarem. Não precisa ler a resposta deles: o próximo `proximo` confere os arquivos.
   d. Volte ao passo a.

3. Rode `npx tsx scripts/questoes/producao.ts relatorio`.

4. Rode `git add data/geradas data/relatorios` e depois `git commit -m "Produção automática: <resumo de uma linha do relatório>"` (se não houver nada para commitar, siga em frente).

5. Termine a resposta com uma única linha no formato `FIM: <motivo>`, em que o motivo é o campo "motivo" do JSON de parada (por exemplo `FIM: teto atingido` ou `FIM: nada pendente`). O script da noite lê essa linha.
