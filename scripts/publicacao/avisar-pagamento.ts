// Aviso único para todos os cadastrados: o pagamento do lançamento falhou e já está normal (e um pedido de
// desculpas). Usa o mesmo e-mail do site (src/server/email.ts) e o serviço configurado (Gmail ou Resend).
// Guarda quem já recebeu em data/avisos/ (fora do git: são e-mails de alunos), então pode rodar em
// vários dias até acabar a lista: quem já recebeu não recebe de novo.
//
//   npx tsx --conditions=react-server scripts/publicacao/avisar-pagamento.ts                     mostra quantos faltam (não envia)
//   npx tsx --conditions=react-server scripts/publicacao/avisar-pagamento.ts --teste voce@email.com   envia só para esse e-mail
//   npx tsx --conditions=react-server scripts/publicacao/avisar-pagamento.ts --aplicar [--limite 90]   envia para quem falta
import "../_env";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { emailPagamentoNormalizado, enviarEmail, servicoDeEmail } from "../../src/server/email";

const ARQUIVO = "data/avisos/pagamento-normalizado.txt";
const args = process.argv.slice(2);
const valor = (nome: string) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
};
const APLICAR = args.includes("--aplicar");
const TESTE = valor("--teste");
// Plano grátis do Resend: 100 e-mails por dia (3.000 por mês). Gmail: uns 500 por dia.
const LIMITE = Number(valor("--limite") ?? (servicoDeEmail() === "gmail" ? 450 : 90));

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const banco = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Os links do e-mail apontam para o site no ar, mesmo com o .env.local em localhost.
  process.env.BETTER_AUTH_URL = "https://riccardonobrega.com";
  const servico = servicoDeEmail();
  console.log(`Banco: ${url.startsWith("libsql://") ? "produção (Turso)" : url}`);
  console.log(`Serviço de e-mail: ${servico ?? "nenhum (só imprime no terminal)"}`);
  if (servico === "resend" && !process.env.EMAIL_REMETENTE) {
    console.log("Atenção: sem EMAIL_REMETENTE (domínio verificado), o Resend só entrega no e-mail dono da conta.");
  }

  if (TESTE) {
    const ok = await enviarEmail({ para: TESTE, ...emailPagamentoNormalizado("Teste") });
    console.log(ok ? `Enviado para ${TESTE}. Confira a caixa de entrada (e o spam).` : "Não saiu. Veja o erro acima.");
    return;
  }

  const enviados = new Set(
    existsSync(ARQUIVO) ? readFileSync(ARQUIVO, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter(Boolean) : [],
  );
  const { rows } = await banco.execute("select name, email from user order by created_at");
  const faltam = rows
    .map((r) => ({ nome: String(r.name ?? "").trim() || "aluno", email: String(r.email).trim() }))
    .filter((u) => !enviados.has(u.email.toLowerCase()));
  console.log(`Cadastrados: ${rows.length}. Já receberam: ${enviados.size}. Faltam: ${faltam.length}.`);

  if (!APLICAR) {
    console.log(`Nada enviado. Use --teste <e-mail> para ver no seu e-mail, ou --aplicar para enviar até ${LIMITE} agora.`);
    return;
  }
  if (!servico) {
    console.log("Nenhum serviço de e-mail configurado: nada enviado.");
    return;
  }

  mkdirSync("data/avisos", { recursive: true });
  let ok = 0;
  let falhas = 0;
  for (const u of faltam.slice(0, LIMITE)) {
    if (await enviarEmail({ para: u.email, ...emailPagamentoNormalizado(u.nome.split(/\s+/)[0] ?? u.nome) })) {
      appendFileSync(ARQUIVO, `${u.email}\n`);
      ok++;
    } else {
      falhas++;
      // Várias falhas seguidas costumam ser o limite do dia: para e continua amanhã.
      if (falhas >= 5 && ok === 0) break;
    }
    process.stdout.write(`\rEnviados: ${ok}  Falhas: ${falhas}`);
    await pausa(600); // o Resend aceita poucos envios por segundo
  }
  const restantes = faltam.length - ok;
  console.log(`\nPronto. Enviados agora: ${ok}. Falhas: ${falhas}. Ainda faltam: ${restantes}.`);
  if (restantes > 0) console.log("Rode o mesmo comando amanhã para continuar de onde parou.");
}

main();
