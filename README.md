# Plataforma de Questões

Banco de questões de múltipla escolha e flashcards, com filtros por disciplina, assunto e status,
e painel de desempenho (hoje, ontem, 7, 15 e 30 dias). Pensado para até ~1 milhão de questões em serviços gratuitos.

Stack: Next.js 16, TypeScript, Tailwind v4, Drizzle, Turso (SQLite), Better Auth, ts-fsrs, Recharts, Vercel.

## Rodar localmente (5 minutos)

Requisitos: Node.js 20 ou superior.

```bash
npm install
cp .env.example .env.local      # em dev pode deixar como está, usa local.db
# gere um segredo e cole em BETTER_AUTH_SECRET:
openssl rand -base64 32
npm run setup                   # cria as tabelas e importa 1.000 questões + 200 flashcards de exemplo
npm run dev
```

Abra http://localhost:3000, crie uma conta e pronto.

Para ver o painel de desempenho com dados: `npm run simular -- seu@email.com 300`.

## Importar suas questões

Converta para o formato de `docs/FORMATO-QUESTOES.md` e rode:

```bash
npm run importar -- data/meu-banco.jsonl
```

## Desenvolvendo com o Claude Code

- `CLAUDE.md`: contexto, regras e comandos do projeto (o Claude Code lê automaticamente).
- `PLANO.md`: roteiro por fases com tarefas e critérios de pronto.
- Comandos prontos em `.claude/commands/`:
  - `/proxima-tarefa` pega a próxima tarefa do plano, implementa, testa e marca como feita (aceita um número, ex.: `/proxima-tarefa 3.2`)
  - `/importar-questoes caminho/do/arquivo` ajuda a converter seu banco para JSONL
  - `/revisar-performance` audita as consultas pensando em 1 milhão de questões e na cota do Turso

## Produção

Veja a Fase 0 do `PLANO.md` para criar o banco no Turso e publicar na Vercel.
