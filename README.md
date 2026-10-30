# Riccardo Nóbrega: plataforma de questões

Plataforma de estudo do Professor Riccardo Nóbrega para concursos policiais do Ceará (PCCE, Guarda Municipal de Fortaleza, CFO PMCE).
O aluno resolve questões de múltipla escolha e de certo ou errado, revisa flashcards, lê as leis no Vade Mecum, acompanha o desempenho e disputa o ranking.
Grátis: 5 questões por dia. Assinatura mensal (Mercado Pago) libera tudo.

Stack: Next.js 16, TypeScript, Tailwind v4, Drizzle, Turso (SQLite), Better Auth, ts-fsrs, Recharts, Vercel.

**Onde parou e o que falta:** [`docs/ESTADO-ATUAL.md`](docs/ESTADO-ATUAL.md). Regras do código: [`CLAUDE.md`](CLAUDE.md). Roteiro: [`PLANO.md`](PLANO.md).

## Rodar localmente

Requisitos: Node.js 20 ou superior.

```bash
npm install
```

O `.env.local` **não vai pelo git** (tem as senhas). Copie o do outro computador ou crie a partir do `.env.example`.
Se o `.env.local` apontar para o Turso de produção, rode o servidor de desenvolvimento com o banco local para não mexer no site real:

```powershell
# PowerShell
$env:TURSO_DATABASE_URL="file:local.db"; $env:TURSO_AUTH_TOKEN=""; npm run dev
```

```bash
# Git Bash
TURSO_DATABASE_URL=file:local.db TURSO_AUTH_TOKEN= npm run dev
```

Sem `local.db` ainda? Crie com o mesmo prefixo: `npm run setup` (tabelas + 1.000 questões de exemplo).
Para ver o desempenho com dados: `npm run simular -- seu@email.com 300`.

## Alimentar com questões

- Pelo site: `/admin` > Questões (gera o prompt, confere e importa o arquivo da IA). Passo a passo em `docs/PROMPT-GERAR-QUESTOES.md`.
- Prompts para usar direto no Claude: `docs/PROMPT-CLAUDE-QUESTOES.md` e `docs/PROMPT-CLAUDE-CERTO-ERRADO.md`.
- Formato do arquivo: `docs/FORMATO-QUESTOES.md`.
- Produção automática com o Claude Code: `/gerar-lote`.

## Documentos

| Arquivo | Para quê |
|---|---|
| `docs/ESTADO-ATUAL.md` | o que está no ar, o que falta e como continuar em outra máquina |
| `CLAUDE.md` | contexto e regras para o Claude Code (lido automaticamente) |
| `PLANO.md` | roteiro por fases (`/proxima-tarefa` pega a próxima) |
| `docs/FORMATO-QUESTOES.md` | contrato do arquivo de questões |
| `docs/PROMPT-*.md` | prompts para gerar questões com IA |
| `docs/ERRO-PENA-QUESTOES.md` | erro das questões focadas em pena e as regras para não repetir |
| `docs/FALTA-CERTO-ERRADO.md` | áreas sem certo ou errado (levantamento de 22/10) |

## Comandos do Claude Code

- `/proxima-tarefa [número]`: pega uma tarefa do `PLANO.md`, implementa e marca como feita.
- `/gerar-lote`: um ciclo da produção automática de questões.
- `/importar-questoes arquivo`: ajuda a converter um banco para o formato de importação.
- `/revisar-performance`: audita as consultas pensando em 1 milhão de questões e na cota do Turso.
