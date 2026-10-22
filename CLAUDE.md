# CLAUDE.md

Contexto do projeto para o Claude Code. Leia antes de qualquer tarefa. O roteiro de trabalho está em `PLANO.md`.

## O que é

Plataforma de estudo com banco de até ~1 milhão de questões de múltipla escolha e flashcards.
O aluno filtra por disciplina, assunto e status (não resolvida, resolvida, acertou, errou),
resolve questões, revisa flashcards com repetição espaçada e acompanha o desempenho
(hoje, ontem, últimos 7, 15 e 30 dias).

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript estrito |
| Estilo | Tailwind CSS v4 (tokens em `src/app/globals.css`), componentes no padrão shadcn/ui |
| Banco | Turso (libSQL, compatível com SQLite). Em dev usa o arquivo `local.db` |
| ORM | Drizzle ORM + drizzle-kit |
| Auth | Better Auth (e-mail e senha), tabelas no próprio banco |
| Validação | Zod v4 |
| Flashcards | ts-fsrs (algoritmo FSRS) |
| Gráficos | Recharts |
| Deploy | Vercel |

## Comandos

```bash
npm run dev            # servidor de desenvolvimento
npm run build          # build de produção (rode antes de dizer que terminou)
npm run typecheck      # checagem de tipos
npm run db:push        # aplica o schema no banco (dev)
npm run db:generate    # gera migração SQL em ./drizzle (produção)
npm run db:migrate     # aplica migrações
npm run db:studio      # interface visual do banco
npm run exemplo        # gera data/exemplo.jsonl (aceita --questoes N --flashcards N --saida arq)
npm run importar -- arquivo.jsonl   # importa questões e flashcards
npm run recontar       # recalcula a tabela contagens
npm run simular -- email@aluno.com 300   # cria respostas falsas para testar o desempenho
npm run setup          # db:push + importar o exemplo
```

## Estrutura

```
src/
  app/
    (acesso)/entrar, (acesso)/cadastrar   páginas públicas
    (app)/layout.tsx                      exige login (exigirUsuario)
    (app)/estudar                         início: tipo (questões ou flashcards), matéria e área (o aluno não escolhe nível)
    (app)/questoes                        resolução (uma por vez) e filtro de status
    (app)/flashcards                      sessão de revisão
    (app)/desempenho                      janelas, gráfico diário, por disciplina
    (app)/ranking                         Fuzil de questões (mais resolvidas) e Bom de Mira (acerto de primeira, mínimo de 30)
    (app)/admin                           área do dono (ADMIN_EMAILS), com menu lateral: visão geral, financeiro,
                                          pessoas (cadastrados x assinantes) e questões (prompt de IA e importação)
    (app)/assinatura                      assinatura mensal (Mercado Pago), cancelar, limite grátis do dia
    (app)/admin/revisao                   fila de revisão: questões e flashcards de IA e itens reportados por alunos
    api/mercadopago/webhook               avisos do Mercado Pago (assinatura e cobranças), opcional
    api/cron/assinaturas                  conferência diária no Mercado Pago (vercel.json, CRON_SECRET)
    api/auth/[...all]                     rotas do Better Auth
  components/                             UI (ui/ são primitivos genéricos; admin/kit.tsx são os blocos do painel do dono)
  db/schema/                              auth.ts, conteudo.ts, estudo.ts, revisao.ts (questoes_revisao)
  db/importacao.ts                        núcleo da importação (script e /admin usam o mesmo)
  lib/                                    código compartilhado (pode ir para o cliente)
  server/                                 consultas e server actions (só servidor)
scripts/                                  importação, geração de exemplo, recontagem, simulação, ícones do app
public/sw.js, public/offline.html         PWA: service worker só mostra a tela "sem internet"; nunca guarda páginas nem dados do aluno
docs/FORMATO-QUESTOES.md                  contrato do arquivo .jsonl
docs/PROMPT-GERAR-QUESTOES.md             prompt para gerar questões de um PDF com IA
data/catalogo.json                        nomes preferidos de matérias e áreas e apelidos (não é lista fechada)
data/taxonomia.json                       tópicos, metas, formatos por banca e recortes de lei (scripts/taxonomia/montar-taxonomia.ts)
data/leis/                                textos legais vigentes (scripts/leis/baixar-leis.ts)
data/jurisprudencia.json                  julgados que a IA pode citar pelo número (o professor preenche)
data/dispositivos-sensiveis.json          artigos com inconstitucionalidade, interpretação conforme ou não recepção: só com nota
prompts/gerador.md, prompts/auditor.md    instruções da geração por IA; scripts/questoes/ (piloto, ajustes, finalizar, api-lotes)
scripts/questoes/producao.ts              produção automática (estado em data/geradas/producao.json); comando /gerar-lote
scripts/questoes/rodar-noite.ps1          rodadas noturnas do Claude sem tela; agendar-noite.ps1 registra no Agendador
src/db/aprovacao.ts                       aprovar, rejeitar e reportar erro (tela e produção usam o mesmo código)
```

## Modelo de dados (resumo)

- `questoes`: conteúdo. `id` inteiro (rowid) para paginação; `codigo` é o id do JSONL (único).
  `alternativas` é JSON na própria linha.
- `flashcards`: frente e verso.
- `disciplinas`, `assuntos` (matéria e área). Criadas na importação (a IA tira do PDF); nomes equivalentes são unidos por `chaveNome()` em `src/lib/catalogo.ts`.
- `questoes.dificuldade`: 1 fácil, 2 médio, 3 difícil (`src/lib/dificuldade.ts`). É opção do aluno na tela de filtro (Opções), mas na questão só aparece depois da resposta.
- `questoes.ordem`: posição sorteada na importação. A listagem segue `(ordem, id)` para misturar níveis e áreas, começando num ponto sorteado por sessão.
- `contagens`: totais pré-calculados (`q:total`, `q:d:<id>`, `q:a:<id>`, `f:total`, `f:d:<id>`, `f:a:<id>`).
- `respostas`: histórico, uma linha por tentativa. Fonte do desempenho.
- `status_questao`: último estado por aluno e questão. Fonte dos filtros e ícones.
  Sem linha = não resolvida. `ultima_correta` = acertou ou errou.
- `revisoes_flashcard`: estado FSRS por aluno e card.
- `placar`: uma linha por aluno (questões diferentes resolvidas e acertos de primeira), atualizada em `responderQuestao`. Fonte do ranking; nunca some o histórico de `respostas` para isso. Recalcular: `scripts/publicacao/placar.ts`.
- `flashcards_revisao`: o mesmo para flashcards. `reportes`: erros reportados por alunos (o item fica `suspensa` e sai das listas e contagens até a revisão).
- `questoes_revisao`: questões geradas por IA aguardando revisão (status pendente_revisao, aprovada, rejeitada). Fora de `questoes` até a aprovação em /admin/revisao.
  A aprovada leva o mesmo `codigo` para `questoes`, com `origem = 'ia'`, `topico_taxonomia`, `subtopico` e `lei_referencia` (nulos nas importadas por arquivo; índice `questoes_origem_topico`).
- `assinaturas`, `pagamentos`: assinatura mensal e cada cobrança do Mercado Pago (fonte do faturamento). Só de quem tem `external_reference` com o prefixo `nobrega-questoes:` (`src/lib/planos.ts`), para separar de outros produtos na mesma conta.
- `user`, `session`, `account`, `verification`: Better Auth. Não renomeie colunas.

## Regras do projeto (não quebre)

1. **Nunca use OFFSET nem `ORDER BY random()`** para listar questões. Use cursor (`WHERE (ordem, id) > (?, ?)`). Com 1 milhão de linhas os dois leem tudo.
2. **Nunca faça `COUNT(*)` sobre `questoes` ou `flashcards` numa requisição.** Leia de `contagens`. No Turso cada linha lida conta na cota mensal. Recontagem só no fim da importação.
3. **O gabarito e o comentário não vão para o cliente antes da resposta.** `listarQuestoes` não seleciona esses campos; só `responderQuestao` (server action) devolve. Mantenha assim em qualquer tela nova.
4. **Toda server action e página do aluno começa com `exigirUsuario()`** e valida a entrada com Zod. Nunca confie em `usuarioId` vindo do cliente.
5. **Datas em UTC no banco.** O agrupamento por dia usa o fuso de Brasília (UTC-3) via `src/lib/datas.ts`. Não espalhe `-3 hours` pelo código; use as constantes.
6. **Importação em lote:** inserts de 500 linhas, `onConflictDoNothing` pelo `codigo`. Um item do JSONL deve gerar uma escrita (por isso alternativas ficam em JSON).
7. **Separação servidor e cliente:** arquivos em `src/server/` importam `server-only` (exceto `acoes.ts`, que é `"use server"`). Constantes e tipos usados nos dois lados ficam em `src/lib/`.
8. **Mudou o formato do JSONL?** Atualize juntos `src/lib/formato-jsonl.ts`, `src/db/importacao.ts`, `src/lib/prompt-ia.ts`, `docs/FORMATO-QUESTOES.md`, `docs/PROMPT-GERAR-QUESTOES.md` e `scripts/gerar-exemplo.ts`.
11. **Pagamentos:** nunca confie no conteúdo do aviso (webhook) nem em parâmetros da URL: pegue só o id e busque o recurso na API do Mercado Pago (`src/server/assinatura.ts`). Sem `MP_ACCESS_TOKEN` a cobrança fica desligada (sem limite diário).
10. **Área do dono:** páginas e ações de `/admin` começam com `exigirAdmin()` (e-mails em `ADMIN_EMAILS`).
12. **Itens suspensos (reportados) não aparecem para o aluno:** toda consulta nova de `questoes` ou `flashcards` para o aluno filtra `suspensa = false`.
9. Toda consulta nova que filtra `questoes` precisa de índice que a cubra. Confira com `EXPLAIN QUERY PLAN` (veja `/revisar-performance`).

## Convenções

- Código, nomes de variáveis, rotas e textos de interface em português do Brasil.
- Textos da interface e documentação: não usar travessões (o caractere longo de pontuação). Use vírgula, dois pontos ou parênteses.
- Componentes de UI novos: siga o padrão de `src/components/ui/` (cva + `cn`). Pode usar `npx shadcn add <componente>`; o `components.json` já está configurado.
- Cores só pelos tokens (`bg-marca`, `bg-superficie`, `bg-camada`, `text-suave`, `text-sobre-marca`, `border-borda`, etc.). Não use cores soltas do Tailwind nem `white/` ou `black/`: há duas visões (escura, padrão, e clara), definidas em `src/app/globals.css`. A escolha fica no cookie `tema` (`src/lib/tema.ts`, botão em `src/components/botao-tema.tsx`); sem cookie, segue o aparelho.
- Server Components por padrão. `"use client"` só onde há estado ou evento.
- `searchParams` e `params` são Promises no Next 16: sempre `await`.

## Antes de concluir uma tarefa

1. `npm run typecheck`
2. `npm run build`
3. Se mexeu em consulta pesada: rode com o banco de carga (veja PLANO.md, fase 2) e confira o plano de execução.
4. Marque a tarefa como feita no `PLANO.md`.

## Ambiente

- `.env.local` (copie de `.env.example`): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAILS`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `CRON_SECRET`, `GMAIL_USUARIO`, `GMAIL_SENHA_APP` (ou `RESEND_API_KEY` e `EMAIL_REMETENTE` com domínio próprio).
- E-mails (recuperar senha, confirmar e-mail) saem por `src/server/email.ts`. Usa o Gmail se configurado, senão o Resend, senão só imprime no terminal.
- Sem `TURSO_DATABASE_URL` o app usa `file:local.db`. Na Vercel o modo arquivo não funciona: use sempre a URL do Turso.
