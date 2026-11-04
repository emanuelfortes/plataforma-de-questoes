import "server-only";
import nodemailer from "nodemailer";
import { linkWhatsapp, whatsappFormatado } from "@/lib/legal";
import { NOME_PLATAFORMA } from "@/lib/marca";
import { ADICIONAL_ELITE, ASSINATURA, ELITE, PROMOCAO, formatarReais } from "@/lib/planos";

// Envio de e-mail. Usa o primeiro serviço configurado:
// 1. Gmail (GMAIL_USUARIO + GMAIL_SENHA_APP): sem domínio próprio, até ~500 e-mails por dia.
// 2. Resend (RESEND_API_KEY): exige domínio próprio verificado para enviar a qualquer pessoa.
// 3. Nenhum (desenvolvimento): o e-mail é só impresso no terminal.
const NOME_REMETENTE = NOME_PLATAFORMA;

type Email = { para: string; assunto: string; html: string; texto: string };

/** Qual serviço vai enviar (para os scripts avisarem antes de um envio em massa). */
export function servicoDeEmail() {
  const { GMAIL_USUARIO, GMAIL_SENHA_APP, RESEND_API_KEY } = process.env;
  if (GMAIL_USUARIO && GMAIL_SENHA_APP) return "gmail" as const;
  if (RESEND_API_KEY) return "resend" as const;
  return null;
}

/** Devolve true se o e-mail saiu (false: falhou ou não há serviço configurado). */
export async function enviarEmail(email: Email) {
  const { GMAIL_USUARIO, GMAIL_SENHA_APP, RESEND_API_KEY } = process.env;
  // Não lança erro: uma falha de e-mail não pode travar cadastro nem expor se a conta existe.
  try {
    if (GMAIL_USUARIO && GMAIL_SENHA_APP) {
      await enviarPorGmail(email, GMAIL_USUARIO, GMAIL_SENHA_APP);
      return true;
    }
    if (RESEND_API_KEY) {
      await enviarPorResend(email, RESEND_API_KEY);
      return true;
    }
  } catch (erro) {
    console.error(`[e-mail] falha ao enviar para ${email.para}:`, erro);
    return false;
  }
  console.info(
    `[e-mail não enviado: nenhum serviço configurado]\nPara: ${email.para}\nAssunto: ${email.assunto}\n${email.texto}`,
  );
  return false;
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
const COR = { fundo: "#262626", marca: "#1b8ed3", destaque: "#e3a52b", texto: "#1d2733", suave: "#5d6a79" };

/** Endereço público do site, para a logo e os links do rodapé (precisam ser absolutos no e-mail). */
function enderecoSite() {
  return (process.env.BETTER_AUTH_URL || "https://riccardonobrega.com").replace(/\/$/, "");
}

function modelo(
  titulo: string,
  paragrafos: string[],
  botao: { rotulo: string; url: string },
  rodape: string,
  /** HTML extra entre o texto e o botão (já montado com estilos inline). */
  extra = "",
) {
  const site = enderecoSite();
  const fonte = "font-family:Arial,Helvetica,sans-serif";
  const corpo = paragrafos
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${COR.texto};${fonte}">${p}</p>`)
    .join("");
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${titulo}</title></head>
<body style="margin:0;padding:0;background:#f3f5f8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-radius:16px;overflow:hidden;background:#ffffff">
      <tr><td align="center" style="background:${COR.fundo};padding:28px 24px 22px">
        <img src="${site}/marca/logo-email.png" width="88" height="88" alt="Professor Riccardo Nóbrega" style="display:block;border:0;width:88px;height:88px">
        <p style="margin:14px 0 0;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${COR.destaque};${fonte}">${NOME_PLATAFORMA}</p>
      </td></tr>
      <tr><td style="padding:32px 32px 8px">
        <h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;color:${COR.fundo};${fonte}">${titulo}</h1>
        ${corpo}
        ${extra}
        <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:28px auto">
          <tr><td style="border-radius:12px;background:${COR.marca}">
            <a href="${botao.url}" style="display:inline-block;padding:15px 30px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px;${fonte}">${botao.rotulo}</a>
          </td></tr>
        </table>
        <p style="margin:0 0 6px;font-size:13px;color:${COR.suave};${fonte}">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
        <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;${fonte}"><a href="${botao.url}" style="color:${COR.marca}">${botao.url}</a></p>
        <p style="margin:0 0 28px;padding:14px 16px;border-radius:10px;background:#f4f6fb;font-size:13px;line-height:1.5;color:${COR.suave};${fonte}">${rodape}</p>
      </td></tr>
      <tr><td align="center" style="background:${COR.fundo};padding:18px 24px">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#a3a3a3;${fonte}">
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

export function emailRenovarPix(nome: string, fim: string, valor: string, url: string): Omit<Email, "para"> {
  const ola = `Olá, ${escapar(nome)}.`;
  const aviso = `Seu acesso pago com Pix vai até ${fim}. Para continuar estudando sem limite, pague o próximo Pix de ${valor}: os 30 dias novos começam quando os atuais acabarem, então renovar antes não perde nenhum dia.`;
  const rodape = "Se não renovar, sua conta volta para o limite grátis de questões por dia. Prefere não se preocupar? Assine no cartão, que renova sozinho.";
  return {
    assunto: `Seu acesso vai até ${fim}: renove com Pix`,
    html: modelo("Renove seu acesso", [ola, aviso], { rotulo: "Pagar com Pix", url }, rodape),
    texto: `Olá, ${nome}.\n\n${aviso}\n\n${url}\n\n${rodape}`,
  };
}

/** Linha de preço do quadro da Black Friday (e-mail aceita só tabela e estilo inline). */
function linhaPreco(nome: string, detalhe: string, de: number, por: number) {
  const fonte = "font-family:Arial,Helvetica,sans-serif";
  return `<tr>
    <td style="padding:14px 16px;border-top:1px solid #3a3a3a">
      <p style="margin:0;font-size:15px;font-weight:bold;color:#ffffff;${fonte}">${nome}</p>
      <p style="margin:2px 0 0;font-size:12px;line-height:1.4;color:#a3a3a3;${fonte}">${detalhe}</p>
    </td>
    <td align="right" style="padding:14px 16px;border-top:1px solid #3a3a3a;white-space:nowrap">
      <p style="margin:0;font-size:12px;color:#a3a3a3;text-decoration:line-through;${fonte}">${formatarReais(de)}</p>
      <p style="margin:0;font-size:20px;font-weight:bold;color:${COR.destaque};${fonte}">${formatarReais(por)}<span style="font-size:12px;font-weight:normal;color:#a3a3a3">/mês</span></p>
    </td>
  </tr>`;
}

/** Aviso único (enviado à mão): o pagamento do lançamento falhou e já voltou ao normal. */
export function emailPagamentoNormalizado(nome: string): Omit<Email, "para"> {
  const site = enderecoSite();
  const url = `${site}/assinatura`;
  const fonte = "font-family:Arial,Helvetica,sans-serif";
  const [dia, mes] = PROMOCAO.ate.split("-").slice(1).reverse();
  const fim = `${dia}/${mes}`;
  const ola = `Olá, ${escapar(nome)}!`;
  const problema =
    "Durante o lançamento da plataforma, tivemos um problema que impediu algumas pessoas de concluir o pagamento. O erro foi nosso, mas já está resolvido! <strong>Agora, o pagamento está funcionando normalmente no cartão de crédito e no Pix.</strong>";
  const desculpas = "Pedimos desculpas pelo transtorno e agradecemos pela paciência.";
  const promocao = `E a Black Friday continua! Quem assinar até <strong>${fim} garante o preço promocional para sempre</strong>, enquanto a assinatura estiver ativa.`;
  const aproveite = "Aproveite! 🚀";
  const quadro = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;border-radius:12px;overflow:hidden;background:${COR.fundo}">
    <tr><td colspan="2" style="padding:14px 16px 12px">
      <p style="margin:0;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${COR.destaque};${fonte}">Black Friday 💀 até ${fim}</p>
    </td></tr>
    ${linhaPreco(ASSINATURA.nome, "Todas as questões e flashcards, sem limite", ASSINATURA.valor, PROMOCAO.basico)}
    ${linhaPreco(ELITE.nome, `Basic + 2 simulados exclusivos por mês (+ ${formatarReais(ADICIONAL_ELITE)})`, ELITE.valor, PROMOCAO.elite)}
    <tr><td colspan="2" style="padding:12px 16px;border-top:1px solid #3a3a3a">
      <p style="margin:0;font-size:13px;line-height:1.5;color:#d4d4d4;${fonte}">💳 Cartão: renova sozinho todo mês<br>⚡ Pix: 30 dias de acesso</p>
    </td></tr>
  </table>`;
  const zap = linkWhatsapp(`Olá! Tive problema para assinar a plataforma ${NOME_PLATAFORMA}.`);
  const rodape = `Ainda com dificuldade para pagar? Chame a gente no WhatsApp <a href="${zap}" style="color:${COR.marca};font-weight:bold">${whatsappFormatado()}</a> que resolvemos com você.`;
  return {
    assunto: "O pagamento já está normal (e um pedido de desculpas)",
    html: modelo("Pagamento funcionando normalmente", [ola, problema, desculpas, promocao, aproveite], { rotulo: "Assinar agora", url }, rodape, quadro),
    texto: [
      `Olá, ${nome}!`,
      ...[problema, desculpas, promocao].map((p) => p.replace(/<\/?strong>/g, "")),
      aproveite,
      `${ASSINATURA.nome}: de ${formatarReais(ASSINATURA.valor)} por ${formatarReais(PROMOCAO.basico)}/mês`,
      `${ELITE.nome}: de ${formatarReais(ELITE.valor)} por ${formatarReais(PROMOCAO.elite)}/mês`,
      `Assine em: ${url}`,
      `Ainda com dificuldade? WhatsApp ${whatsappFormatado()}: ${zap}`,
    ].join("\n\n"),
  };
}
