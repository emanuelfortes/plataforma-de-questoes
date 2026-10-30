# Estado do projeto (30/10/2026)

Onde o projeto parou, o que está no ar e o que falta. Leia antes de continuar em outra máquina.
Ao continuar com o Claude Code, peça para ele ler este arquivo primeiro.

## 1. Continuar em outra máquina

1. **Baixar o código:** `git pull` (ou `git clone https://github.com/emanuelfortes/plataforma-de-questoes.git`).
2. **Instalar:** `npm install` (Node 20 ou superior).
3. **`.env.local`:** não vai pelo git, porque tem as senhas. A pasta do projeto está no OneDrive: se a outra máquina usa a mesma conta, o arquivo já está lá. Se não, copie de pendrive.
   Nunca cole o token do Turso no chat nem no `.env.example` (ele vai para o GitHub).
4. **Cuidado: o `.env.local` aponta para a produção (Turso).** Qualquer script com `--aplicar`, `npm run importar` ou `npm run db:push` grava no site real.
   Para testar sem risco, use o banco local:

   ```powershell
   $env:TURSO_DATABASE_URL="file:local.db"; $env:TURSO_AUTH_TOKEN=""; npm run dev
   ```

   O `local.db` não vai pelo git. Sem ele, crie com `npm run setup` usando o mesmo prefixo acima.
5. **Antes de dar por encerrado:** `npm run typecheck` e `npm run build`. O push para a `main` publica na Vercel sozinho.

Pastas que ficam só neste computador (fora do git; o OneDrive pode sincronizar):

- `data/backups/`: cópias do banco de produção antes de cada correção em massa (só a de 19/10 está no git).
- `data/geradas/chat/`: os lotes de questões feitos no chat do Claude (já importados na produção).

## 2. O que está no ar

**Produção:** 10.929 questões (cerca de 14% de certo ou errado), 6.900 delas ligadas a artigos de lei.

| Área | Situação |
|---|---|
| Questões | filtro por matéria, área, status e Opções (nível, tipo, resolução); pastas por crime no Penal; tesourinha; questão errada volta 4 questões depois; comentário em partes (explicação, alternativa por alternativa, letra da lei, pegadinha) |
| Plano grátis | 5 questões diferentes por dia. Flashcards, desempenho e Vade Mecum com cadeado |
| Assinatura | R$ 25 por mês no Mercado Pago, conferência diária (cron) |
| Ranking | Fuzil de Questões e Bom de Mira, patentes, pódio, sequência de acertos; chute (menos de 8 s) não pontua |
| Vade Mecum | 41 leis em leitura guiada, selos de atualização, aviso do STF, "N questões cobram este artigo" |
| Área do dono | visão geral, financeiro, pessoas, questões (prompt e importação), revisão (IA e reportes), Vade Mecum (explicações) |

### Vade Mecum: como funciona

- Os textos das leis estão em `data/leis/*.txt` (baixados do Planalto por `scripts/leis/baixar-leis.ts`). A leitura fica em `src/server/vade-mecum.ts`.
- Em 30/10 a leitura foi corrigida em vários pontos: "Art. 157 - Subtrair" virava "157-S"; uma redação antiga repetida aparecia junto com a nova; documento colado no fim do arquivo era lido como lei; dispositivo revogado aparecia em branco. Se uma lei nova aparecer estranha, o problema provavelmente está nesse arquivo.
- **Questões por artigo:** tabela `artigos_questao`, preenchida na importação. Para refazer tudo: `npx tsx scripts/publicacao/artigos-questoes.ts --aplicar`.
- **"Entender este artigo":** tabela `explicacoes_artigo`. O lote 1 (126 artigos mais cobrados) está em `data/vade-mecum/explicacoes-lote-1.json` e já foi gravado na produção como **pendente**. O aluno só vê depois que o professor aprova em `/admin/vade-mecum`.

## 3. O que falta

### Para o professor

- [ ] **Revisar as 126 explicações** em `/admin/vade-mecum`. As 35 marcadas "conferir" vêm primeiro: decisões do STF, mudanças recentes e 16 artigos cujo texto foi corrigido depois de a explicação ser escrita.
  Atenção: os textos das leis são de 2026, mais novos que o conhecimento da IA. Exemplo: o § 5º do art. 171 do CP foi revogado pela Lei 15.397/2026 e o § 5º do art. 180, pela Lei 15.358/2026.
- [ ] Conferir `data/dispositivos-sensiveis.json` e preencher `data/jurisprudencia.json`.

### Para desenvolver

- [ ] **Grifos e anotações do aluno na lei** (Vade Mecum). Precisa de uma tabela nova na produção.
- [ ] **Explicação do CP art. 313-A** (descartada do lote 1 porque foi escrita sobre o texto errado) e um **lote 2** de explicações.
- [ ] **Certo ou errado:** faltam cerca de 11.500 para a meta de 50 por área (`docs/FALTA-CERTO-ERRADO.md`, levantamento de 22/10).
- [ ] Demais tarefas abertas no `PLANO.md` (busca por texto, simulado, caderno de erros, flashcards, testes, migrações versionadas).

### Decisões que ficaram em aberto

- O `/gerar-lote` deve passar a gerar certo ou errado?
- No Penal, a meta de certo ou errado vale por crime ou por pasta?
- Ranking semanal, além do geral?
- O aluno pode sair do ranking (opção de não aparecer)?
- Pastas também na Parte Geral do Penal e no Constitucional?
- Ordem das áreas do Penal: falta a lista do professor.

### Conferir na produção (não sei se já foi feito)

- E-mail: `GMAIL_USUARIO` e `GMAIL_SENHA_APP` na Vercel (sem isso, recuperar senha e confirmar e-mail não chegam).
- Mercado Pago: credenciais da aplicação e o webhook configurados na Vercel.

## 4. Como o dono trabalha (para o Claude Code)

- Testa no iPhone (Safari): confira o layout no celular e evite espaço apertado.
- O dono faz o `git push` à mão. Quando um script precisa rodar na produção antes do push, diga isso claramente, com os comandos em ordem.
- Mudança em massa no banco de produção: backup antes (`scripts/publicacao/backup-producao.ts <rotulo>`), script com prévia, e só grava com `--aplicar`.
