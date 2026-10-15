import "server-only";
import nodemailer from "nodemailer";

// Envio de e-mail. Usa o primeiro serviço configurado:
// 1. Gmail (GMAIL_USUARIO + GMAIL_SENHA_APP): sem domínio próprio, até ~500 e-mails por dia.
// 2. Resend (RESEND_API_KEY): exige domínio próprio verificado para enviar a qualquer pessoa.
// 3. Nenhum (desenvolvimento): o e-mail é só impresso no terminal.
const NOME_REMETENTE = "Plataforma de Questões";

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

function modelo(titulo: string, paragrafos: string[], botao: { rotulo: string; url: string }, rodape: string) {
  const corpo = paragrafos
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#1b1b19">${p}</p>`)
    .join("");
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f6f6f3;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e3de;border-radius:12px;padding:28px">
    <h1 style="margin:0 0 16px;font-size:20px;color:#1b1b19">${titulo}</h1>
    ${corpo}
    <p style="margin:24px 0">
      <a href="${botao.url}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">${botao.rotulo}</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#6a6964">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
    <p style="margin:0 0 16px;font-size:13px;word-break:break-all"><a href="${botao.url}" style="color:#0f766e">${botao.url}</a></p>
    <p style="margin:0;font-size:13px;color:#6a6964">${rodape}</p>
  </div>
</body></html>`;
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
