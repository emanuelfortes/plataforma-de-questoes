---
description: Pega a próxima tarefa aberta do PLANO.md, implementa, verifica e marca como feita
argument-hint: "[número da tarefa, opcional, ex: 3.2]"
---

1. Leia `CLAUDE.md` e `PLANO.md`.
2. Se foi passado um número ($ARGUMENTS), trabalhe nessa tarefa. Senão, escolha a primeira tarefa `[ ]` a partir da Fase 2 (a Fase 0 é manual do usuário; se ela estiver aberta, apenas lembre o usuário).
3. Antes de codar, diga em poucas linhas o que vai fazer e quais arquivos vai mexer. Se a tarefa for grande, quebre em passos.
4. Implemente seguindo as "Regras do projeto" do `CLAUDE.md`, principalmente: cursor em vez de OFFSET, nada de COUNT em `questoes` por requisição, gabarito nunca vai para o cliente antes da resposta, `exigirUsuario()` e Zod em toda action.
5. Se mudar o schema, rode `npm run db:push` (dev) e diga se precisa de migração em produção.
6. Rode `npm run typecheck` e `npm run build`. Corrija até passar.
7. Marque a tarefa como `[x]` no `PLANO.md` e registre em "Decisões registradas" qualquer escolha de arquitetura que tenha feito.
8. Termine com um resumo curto: o que mudou, como testar na mão, e qual é a próxima tarefa.
