import "server-only";
import nodemailer from "nodemailer";
import { NOME_PLATAFORMA } from "@/lib/marca";

// Envio de e-mail. Usa o primeiro serviço configurado:
// 1. Gmail (GMAIL_USUARIO + GMAIL_SENHA_APP): sem domínio próprio, até ~500 e-mails por dia.
// 2. Resend (RESEND_API_KEY): exige domínio próprio verificado para enviar a qualquer pessoa.
// 3. Nenhum (desenvolvimento): o e-mail é só impresso no terminal.
const NOME_REMETENTE = NOME_PLATAFORMA;

type Email = { para: string; assunto: string; html: string; texto: string };

export async function enviarEmail(email: Email) {
  const { GMAIL_USUARIO, GMAIL_SENHA_APP, RESEND_API_KEY } = process.env;
  // Não lança erro: uma falha de e-mail não pode travar cadastro nem expor se a conta existe.
  try {
    if (GMAIL_USUARIO && GMAIL_SENHA_APP) return await enviarPorGmail(email, GMAIL_USUARIO, GMAIL_SENHA_APP);
    if (RESEND_API_KEY) return await enviarPorResend(email, RESEND_API_KEY);
  } catch (erro) {
    console.error(`[e-mail] falha ao enviar para ${email.para}:`, erro);
    return;
  }
  console.info(
    `[e-mail não enviado: nenhum serviço configurado]\nPara: ${email.para}\nAssunto: ${email.assunto}\n${email.texto}`,
  );
}

async function enviarPorGmail({ para, assunto, html, texto }: Email, usuario: string, senhaApp: string) {
  const transporte = nodemailer.createTransport({
    service: "gmail",
    // A senha de app do Google vem em grupos com espaços; o SMTP aceita sem eles.
    auth: { user: usuario, pass: senhaApp.replace(/\s/g, "") },
  });
  await transporte.sendMail({
    from: { name: NOME_REMETENTE, address: usuario },
    to: para,
    subject: assunto,
    html,
    text: texto,
  });
}

async function enviarPorResend({ para, assunto, html, texto }: Email, chave: string) {
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Sem domínio verificado, onboarding@resend.dev só entrega no e-mail dono da conta do Resend.
      from: process.env.EMAIL_REMETENTE || `${NOME_REMETENTE} <onboarding@resend.dev>`,
      to: [para],
      subject: assunto,
      html,
      text: texto,
    }),
  });

  if (!resposta.ok) throw new Error(`Resend ${resposta.status}: ${await resposta.text()}`);
}

function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Cores da marca (src/app/globals.css). E-mail não lê CSS externo: tudo vai inline, em tabelas,
// que é o que Gmail, Outlook e celulares exibem do mesmo jeito.
const COR = { fundo: "#081433", marca: "#2f6bff", destaque: "#ffb020", texto: "#1b2233", suave: "#5b6478" };

/** Endereço público do site, para a logo e os links do rodapé (precisam ser absolutos no e-mail). */
function enderecoSite() {
  return (process.env.BETTER_AUTH_URL || "https://riccardonobrega.com").replace(/\/$/, "");
}

function modelo(titulo: string, paragrafos: string[], botao: { rotulo: string; url: string }, rodape: string) {
  const site = enderecoSite();
  const fonte = "font-family:Arial,Helvetica,sans-serif";
  const corpo = paragrafos
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${COR.texto};${fonte}">${p}</p>`)
    .join("");
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${titulo}</title></head>
<body style="margin:0;padding:0;background:#eef1f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f7">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-radius:16px;overflow:hidden;background:#ffffff">
      <tr><td align="center" style="background:${COR.fundo};padding:28px 24px 22px">
        <img src="${site}/marca/logo-email.png" width="88" height="88" alt="Professor Riccardo Nóbrega" style="display:block;border:0;width:88px;height:88px">
        <p style="margin:14px 0 0;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${COR.destaque};${fonte}">${NOME_PLATAFORMA}</p>
      </td></tr>
      <tr><td style="padding:32px 32px 8px">
        <h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;color:${COR.fundo};${fonte}">${titulo}</h1>
        ${corpo}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0">
          <tr><td style="border-radius:12px;background:${COR.marca}">
            <a href="${botao.url}" style="display:inline-block;padding:15px 30px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px;${fonte}">${botao.rotulo}</a>
          </td></tr>
        </table>
        <p style="margin:0 0 6px;font-size:13px;color:${COR.suave};${fonte}">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
        <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;${fonte}"><a href="${botao.url}" style="color:${COR.marca}">${botao.url}</a></p>
        <p style="margin:0 0 28px;padding:14px 16px;border-radius:10px;background:#f4f6fb;font-size:13px;line-height:1.5;color:${COR.suave};${fonte}">${rodape}</p>
      </td></tr>
      <tr><td align="center" style="background:${COR.fundo};padding:18px 24px">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#9aa6c4;${fonte}">
          <a href="${site}" style="color:#ffffff;font-weight:bold;text-decoration:none">${site.replace(/^https?:\/\//, "")}</a><br>
          Este é um e-mail automático. Não responda esta mensagem.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function emailRedefinirSenha(nome: string, url: string): Omit<Email, "para"> {
  const ola = `Olá, ${escapar(nome)}.`;
  const pedido = "Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora.";
  const rodape = "Se não foi você, ignore este e-mail. Sua senha continua a mesma.";
  return {
    assunto: "Redefinir sua senha",
    html: modelo("Redefinir senha", [ola, pedido], { rotulo: "Criar nova senha", url }, rodape),
    texto: `Olá, ${nome}.\n\n${pedido}\n\n${url}\n\n${rodape}`,
  };
}

export function emailConfirmarEndereco(nome: string, url: string): Omit<Email, "para"> {
  const ola = `Olá, ${escapar(nome)}.`;
  const pedido = "Confirme seu e-mail para conseguir recuperar a senha caso a esqueça. O link vale por 24 horas.";
  const rodape = "Se você não criou uma conta, ignore este e-mail.";
  return {
    assunto: "Confirme seu e-mail",
    html: modelo("Confirme seu e-mail", [ola, pedido], { rotulo: "Confirmar e-mail", url }, rodape),
    texto: `Olá, ${nome}.\n\n${pedido}\n\n${url}\n\n${rodape}`,
  };
}
