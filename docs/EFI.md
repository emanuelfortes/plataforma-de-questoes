# Efí: Pix e cartão recorrente

Desde 08/11/2026 os pagamentos novos saem pela Efí (Pix de 30 dias e assinatura mensal no cartão). O Mercado Pago
continua só para quem já assinava nele: as assinaturas antigas seguem renovando, o cron e o webhook dele continuam.

## Como funciona (código)

| Arquivo | O que faz |
|---|---|
| `src/server/efi.ts` | Cliente das APIs da Efí: token, certificado (mTLS) e as chamadas |
| `src/server/assinatura-efi.ts` | Gerar Pix, assinar no cartão, conferir, cancelar, trocar de plano, avisos |
| `src/server/assinatura.ts` | Escolhe Efí ou Mercado Pago pelo id da linha (Efí configurada = tudo novo vai para ela) |
| `src/components/assinatura/formulario-cartao-efi.tsx` | Formulário do cartão (token gerado no navegador pelo `payment-token-efi`) |
| `src/app/api/efi/pix` | Aviso de Pix pago |
| `src/app/api/efi/cobrancas` | Aviso das cobranças do cartão |
| `scripts/efi/configurar.ts` | Confere as credenciais e cadastra o aviso de Pix |

Ids nas tabelas (sem coluna nova no banco):

- Pix da Efí: `assinaturas.id = "pix:efi:<txid>"` (começa com `pix:`, então conta como Pix no painel) e `pagamentos.id = "efi-pix:<txid>"`.
- Cartão da Efí: `assinaturas.id = "efi:<subscription_id>"` e `pagamentos.id = "efi:<charge_id>"`.
- Os status são gravados no vocabulário que o app já usava (`authorized`, `cancelled`, `paused`, `approved`, `rejected`...).

Segurança, como no Mercado Pago: o aviso nunca é usado como verdade. Só pegamos o txid (Pix) ou o token (cobranças) e
buscamos tudo na API da Efí. A Vercel não faz TLS mútuo, então o aviso de Pix é cadastrado com `x-skip-mtls-checking`
e as duas URLs levam um segredo (`?hmac=<EFI_WEBHOOK_SEGREDO>`); sem ele a rota responde 401.

## Passo a passo do dono

### 1. Conta e aplicação

1. Conta Efí (PJ de preferência) com a chave Pix cadastrada. Crie uma **chave aleatória** no app (Pix, Minhas chaves).
2. No painel web: **API > Aplicações > Criar aplicação** (nome: QProva).
3. Ative a **API Pix** com os escopos: `cob.write`, `cob.read`, `pix.read`, `pix.write`, `webhook.write`, `webhook.read`, `payloadlocation.read`.
4. Ative a **API Cobranças** (assinaturas e cartão).
5. Anote o **Client_Id** e o **Client_Secret** de **Homologação** e de **Produção** (são diferentes).

### 2. Certificado

1. **API > Meus Certificados**: gere um certificado de **Homologação** e outro de **Produção** (arquivo `.p12`).
2. Transforme em base64 (uma linha só). No PowerShell:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\caminho\producao.p12")) | Set-Clipboard
   ```

   O texto fica copiado; cole como valor de `EFI_CERTIFICADO`. Não cole o certificado no chat nem no git.

### 3. Identificador de conta

**API > Introdução > Identificador de conta** (ou "Obter identificador de conta"). É público: vai para o navegador.

### 4. Variáveis

No `.env.local` (teste) e na Vercel (Settings > Environment Variables, produção):

| Variável | Valor |
|---|---|
| `EFI_CLIENT_ID` | Client_Id do ambiente |
| `EFI_CLIENT_SECRET` | Client_Secret do ambiente |
| `EFI_CERTIFICADO` | o `.p12` em base64 (passo 2) |
| `EFI_CHAVE_PIX` | a chave aleatória (passo 1.1) |
| `EFI_SANDBOX` | `true` em homologação; apague (ou `false`) em produção |
| `EFI_WEBHOOK_SEGREDO` | texto aleatório longo, só letras e números (ex.: gere com o comando abaixo) |
| `NEXT_PUBLIC_EFI_CONTA` | identificador de conta (passo 3). Sem ela, o cartão continua no Mercado Pago |

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_})
```

Credenciais, certificado e identificador de conta têm que ser do **mesmo ambiente** (homologação ou produção).

Ligou só o Pix (sem `NEXT_PUBLIC_EFI_CONTA`)? Então o Pix novo sai pela Efí e o cartão continua no Mercado Pago.

### 5. Testar em homologação (local)

```powershell
$env:TURSO_DATABASE_URL="file:local.db"; $env:TURSO_AUTH_TOKEN=""; npm run dev
npx tsx --conditions=react-server scripts/efi/configurar.ts
```

O script tem que dizer "Credenciais e certificado OK". Em homologação o Pix não é pago de verdade; o cartão de teste
segue a documentação da Efí (dev.efipay.com.br, API Cobranças, cartão).

No site local: gerar um Pix (aparece o QR code), assinar no cartão de teste, cancelar e trocar Basic/Tropa de Elite.
Os avisos não chegam em `localhost`: a tela de assinatura e o cron conferem sozinhos.

### 6. Produção

1. Troque as variáveis da Vercel pelas de **produção** (sem `EFI_SANDBOX`) e faça o deploy (`git push`).
2. Com o `.env.local` apontando para as credenciais de produção e `BETTER_AUTH_URL=https://riccardonobrega.com`:

   ```powershell
   npx tsx --conditions=react-server scripts/efi/configurar.ts --aplicar
   ```

   Isso cadastra o aviso de Pix na chave. O aviso do cartão vai sozinho em cada assinatura.
3. Faça um Pix de verdade com a sua conta (ou de um monitor) e confira: acesso liberado, linha "Pix (Efí)" em `/admin/financeiro`.
4. Uma assinatura de verdade no cartão e o cancelamento logo depois (se precisar, estorne pelo painel da Efí).

### Voltar para o Mercado Pago

Apague `EFI_CHAVE_PIX` (Pix volta ao Mercado Pago) e `NEXT_PUBLIC_EFI_CONTA` (cartão volta) na Vercel e refaça o deploy.
O que já foi pago na Efí continua valendo e sendo conferido.

## Pontos para conferir no primeiro teste

- **Troca de plano no cartão** (`PUT /v1/subscription/:id` com `items`): a documentação lista o campo, mas não deixa claro
  se muda o valor das próximas cobranças. Se der erro, a tela mostra "Não foi possível trocar de plano" e o log da Vercel
  traz a resposta da Efí.
- **Dias grátis** (`trial_days`) para quem reativa ou assina o Basic ainda com acesso pago: confira se a 1ª cobrança
  fica para o dia certo.
- **Campos obrigatórios do titular:** mandamos todos (nome, CPF, e-mail, celular, nascimento e endereço).
