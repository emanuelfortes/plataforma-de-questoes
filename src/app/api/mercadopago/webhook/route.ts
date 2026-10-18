import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";
import { sincronizarAssinatura, sincronizarPagamento } from "@/server/assinatura";

// Avisos do Mercado Pago sobre assinaturas. Configure em Suas integrações > (aplicação
// Nóbrega Questões) > Webhooks: URL https://riccardonobrega.com/api/mercadopago/webhook,
// eventos "Planos e assinaturas". O segredo de assinatura vai em MP_WEBHOOK_SECRET.
//
// Segurança: além de validar a assinatura do aviso, nunca usamos o conteúdo dele. Só pegamos o id
// e buscamos o recurso na API com o nosso token, então um aviso falso não muda nada.
export async function POST(requisicao: Request) {
  const url = new URL(requisicao.url);
  const corpo = (await requisicao.json().catch(() => ({}))) as {
    type?: string;
    topic?: string;
    data?: { id?: string | number };
  };
  const tipo = corpo.type ?? corpo.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = String(corpo.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!tipo || !id) return new Response("ok");

  const segredo = process.env.MP_WEBHOOK_SECRET;
  const assinatura = requisicao.headers.get("x-signature");
  if (segredo && assinatura) {
    try {
      WebhookSignatureValidator.validate({
        xSignature: assinatura,
        xRequestId: requisicao.headers.get("x-request-id"),
        dataId: url.searchParams.get("data.id") ?? id,
        secret: segredo,
      });
    } catch (erro) {
      if (erro instanceof InvalidWebhookSignatureError) {
        console.warn("[mercadopago] aviso com assinatura inválida:", erro.reason);
        return new Response("assinatura inválida", { status: 401 });
      }
      throw erro;
    }
  }

  try {
    if (tipo === "subscription_preapproval" || tipo === "preapproval") await sincronizarAssinatura(id);
    else if (tipo === "subscription_authorized_payment" || tipo === "authorized_payment") await sincronizarPagamento(id);
    // Outros tipos (pagamentos avulsos, planos...) não são desta integração: só confirmamos o recebimento.
  } catch (erro) {
    // Devolver erro faz o Mercado Pago tentar de novo mais tarde (a cada 15 minutos).
    console.error(`[mercadopago] falha ao processar ${tipo} ${id}:`, erro);
    return new Response("erro", { status: 500 });
  }
  return new Response("ok");
}
