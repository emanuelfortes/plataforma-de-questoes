# Plano do projeto

Roteiro de implementação. Cada fase tem tarefas com critério de pronto.
No Claude Code, use `/proxima-tarefa` para ele pegar a próxima tarefa aberta, implementar e marcar aqui.

Legenda: `[x]` feito, `[ ]` a fazer.

---

## Fase 0: Contas e serviços (você faz, uma vez)

Todos com plano gratuito. Limites mudam: confira as páginas de preço antes de crescer.

- [ ] **GitHub:** crie o repositório e suba este projeto.
  ```bash
  git init && git add . && git commit -m "Projeto base" && git branch -M main
  git remote add origin git@github.com:SEU_USUARIO/plataforma-questoes.git && git push -u origin main
  ```
- [ ] **Turso (banco):** crie a conta e o banco.
  ```bash
  curl -sSfL https://get.tur.so/install.sh | bash   # instala a CLI (macOS/Linux; no Windows use WSL)
  turso auth signup
  turso db locations                                 # escolha a região mais próxima do Brasil
  turso db create plataforma-questoes --location <regiao>
  turso db show plataforma-questoes --url            # vai em TURSO_DATABASE_URL
  turso db tokens create plataforma-questoes         # vai em TURSO_AUTH_TOKEN
  ```
  Plano grátis: 5 GB de armazenamento, 500 milhões de linhas lidas e 10 milhões de linhas escritas por mês.
- [ ] **Segredo do Better Auth:** `openssl rand -base64 32` e coloque em `BETTER_AUTH_SECRET`.
- [ ] **`.env.local`:** copie `.env.example`, preencha, rode `npm run db:push` contra o Turso.
- [ ] **Vercel:** importe o repositório, cadastre as 4 variáveis de ambiente (com `BETTER_AUTH_URL` = URL de produção) e faça o deploy.
  Em Settings > Functions, escolha a região mais próxima do banco.
  Atenção: o plano Hobby da Vercel é para uso não comercial. Se for cobrar dos alunos, veja a Fase 8.

---

## Fase 1: Base (entregue)

- [x] Next.js 16 + TypeScript + Tailwind v4 + Drizzle + Turso + Better Auth
- [x] Schema: conteúdo, estudo (respostas, status, revisões FSRS), auth
- [x] Cadastro, login, logout e proteção das páginas
- [x] Questões: filtros por disciplina, assunto e 4 status com contagem; paginação por cursor
- [x] Resolver questão: gabarito e comentário só depois de responder; ícone de status atualiza
- [x] Flashcards: sessão com vencidos + novos, virar card, 4 notas (FSRS)
- [x] Desempenho: hoje, ontem, 7, 15 e 30 dias (acertos, erros, %), gráfico diário, tabela por disciplina
- [x] Importação JSONL em streaming com validação Zod, log de erros e reimportação idempotente
- [x] Gerador de dados de exemplo e simulador de respostas

---

## Fase 2: Conteúdo real e teste de carga

- [ ] **2.1 Teste de carga com 1 milhão.** `npm run exemplo -- --questoes 1000000 --flashcards 50000 --saida data/carga.jsonl` e importe num banco Turso de teste.
  Pronto quando: importação concluída, tamanho medido (`turso db show`), páginas de questões respondendo em menos de 300 ms com e sem filtros.
- [ ] **2.2 Conversor do seu banco atual para JSONL.** Script em `scripts/converter-<origem>.ts` que lê sua fonte (CSV, JSON, outro banco) e gera o formato de `docs/FORMATO-QUESTOES.md`.
  Pronto quando: `npm run importar` aceita o arquivo gerado com 0 inválidas (ou com as inválidas explicadas).
- [ ] **2.3 Importação real em produção.** Rodar contra o Turso de produção, conferir contagens e o log de erros.
- [ ] **2.4 Orçamento de cota.** Anotar quanto a importação consumiu de linhas escritas no painel do Turso. A cota mensal é de 10 milhões: importar 1 milhão de uma vez cabe, mas evite reimportar tudo várias vezes no mesmo mês.

---

## Fase 3: Experiência de questões

- [ ] **3.1 Filtros por banca e ano.** Colunas já existem. Adicionar selects, índices compostos e contagens (`q:b:<banca>` etc.) se for exibir totais.
- [ ] **3.2 Busca por texto (FTS5).** Tabela virtual `questoes_fts` com `enunciado`, populada na importação; campo de busca na listagem.
  Pronto quando: busca em 1 milhão retorna em menos de 300 ms. Cuidado: o índice FTS ocupa espaço (medir).
- [ ] **3.3 Página de uma questão** `/questoes/[id]` (link compartilhável) e navegação anterior/próxima.
- [ ] **3.4 Atualizar contagens dos chips após responder** sem perder o feedback da questão (atualização otimista no cliente).
- [ ] **3.5 Formatação rica no enunciado:** Markdown, tabelas, fórmulas (KaTeX) e imagens. Imagens em armazenamento de objetos (Cloudflare R2 tem plano grátis), só a URL no banco.
- [ ] **3.6 Favoritar e anotações por questão** (tabelas `favoritos` e `anotacoes`, filtro "Favoritas").
- [ ] **3.7 Caderno de erros:** atalho que abre o filtro "Errei" da disciplina com pior desempenho.
- [ ] **3.8 Simulado:** N questões aleatórias de um filtro, cronômetro, correção ao final.
- [ ] **3.9 Reportar erro na questão** (tabela `reportes`, tela simples de revisão para o admin).

---

## Fase 4: Flashcards

- [ ] **4.1 Contador de cards vencidos** no menu e na página.
- [ ] **4.2 Gerar flashcard a partir de questão errada** (botão no card de resultado).
- [ ] **4.3 Decks do aluno:** criar, editar e excluir cards próprios.
- [ ] **4.4 Meta diária de novos cards** configurável (hoje fixa em 10 em `src/server/flashcards.ts`).
- [ ] **4.5 Atalhos de teclado:** espaço vira, 1 a 4 avaliam.

---

## Fase 5: Desempenho

- [ ] **5.1 Desempenho por assunto** dentro de cada disciplina (clique na linha da tabela).
- [ ] **5.2 Sequência de dias estudando** (streak) e meta diária de questões.
- [ ] **5.3 Filtro de período personalizado** (de/até).
- [ ] **5.4 Desempenho de flashcards** (retenção, cards maduros, revisões por dia).
- [ ] **5.5 Se o histórico crescer muito:** tabela de agregados diários por aluno (`desempenho_diario`) atualizada a cada resposta, para não varrer `respostas`.

---

## Fase 6: Contas

- [ ] **6.1 Login com Google** (Better Auth `socialProviders`, já comentado em `src/lib/auth.ts`).
- [ ] **6.2 Recuperar senha e verificar e-mail** (Better Auth + serviço de e-mail transacional com plano grátis, como o Resend).
- [ ] **6.3 Página de perfil:** nome, senha, excluir conta.
- [ ] **6.4 LGPD:** exportar meus dados e excluir conta com remoção do histórico (as FKs já têm `onDelete: cascade`).
- [ ] **6.5 Papel de administrador** (campo `role` no usuário) para telas internas.

---

## Fase 7: Produção e qualidade

- [ ] **7.1 Migrações versionadas:** trocar `db:push` por `db:generate` + `db:migrate` em produção.
- [ ] **7.2 Testes:** Vitest para `src/server` e `scripts/lib`; Playwright para login, responder, flashcard e desempenho.
- [ ] **7.3 CI no GitHub Actions:** typecheck, build e testes em cada PR.
- [ ] **7.4 Rate limit nas server actions** (Better Auth tem rate limit para auth; para `responderQuestao` usar contador simples por usuário).
- [ ] **7.5 Cache do conteúdo:** listas de disciplinas e assuntos mudam só na importação; cachear e invalidar ao importar.
- [ ] **7.6 Monitoramento:** acompanhar linhas lidas no painel do Turso toda semana; logs de erro (Vercel tem logs no grátis).
- [ ] **7.7 Modo escuro:** redefinir os tokens de `globals.css` sob `prefers-color-scheme: dark`.
- [ ] **7.8 PWA / mobile:** manifest, ícone e layout testado em 360 px.

---

## Fase 8: Monetização (se for cobrar)

- [ ] **8.1 Hospedagem comercial:** Vercel Pro ou migrar para Cloudflare (Workers + OpenNext), que permite uso comercial no grátis.
- [ ] **8.2 Planos:** grátis (limite de questões por dia) e premium.
- [ ] **8.3 Pagamento:** Mercado Pago ou Stripe (Pix e cartão), webhook que ativa o plano.
- [ ] **8.4 Página de vendas** e termos de uso / política de privacidade.

---

## Decisões registradas

| Decisão | Motivo |
|---|---|
| Turso em vez de Neon/Supabase | 1 milhão de questões ocupa 2 a 4 GB; Turso grátis tem 5 GB, Neon e Supabase não comportam no grátis |
| Alternativas em JSON na questão | 1 escrita por questão na importação (cota de 10 milhões de escritas/mês) |
| Tabela `contagens` | `COUNT(*)` em 1 milhão a cada página estouraria a cota de leituras |
| `respostas` + `status_questao` | histórico completo para o desempenho e estado atual barato para os filtros |
| "Acertou/errou" pela última tentativa | padrão das plataformas de questões; o histórico completo continua em `respostas` |
| Janela de 7 dias inclui hoje | "últimos 7 dias" = hoje e os 6 anteriores |
| UTC-3 fixo | Brasil sem horário de verão desde 2019; trocar por fuso por usuário se atender outros países |
