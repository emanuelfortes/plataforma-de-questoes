import { processarNotificacaoEfi } from "@/server/assinatura-efi";
import { avisoAutorizado } from "@/server/aviso-efi";

// Avisos da API de Cobranças da Efí (assinatura no cartão e cada cobrança mensal). A URL vai em cada assinatura
// (metadata.notification_url), com o segredo. O aviso traz só um token: as mudanças são buscadas na API.
export const maxDuration = 30;

export async function POST(requisicao: Request) {
  const url = new URL(requisicao.url);
  if (!avisoAutorizado(url)) {
    console.warn("[efi] aviso de cobrança sem o segredo certo, ip:", requisicao.headers.get("x-forwarded-for"));
    return new Response("não autorizado", { status: 401 });
  }
  // Vem como formulário (notification=<token>); aceita JSON também.
  let token: string | null = null;
  const tipo = requisicao.headers.get("content-type") ?? "";
  if (tipo.includes("application/json")) {
    token = ((await requisicao.json().catch(() => ({}))) as { notification?: string }).notification ?? null;
  } else {
    const form = await requisicao.formData().catch(() => null);
    const valor = form?.get("notification");
    token = typeof valor === "string" ? valor : null;
  }
  if (!token || token.length > 200) return new Response("ok");
  try {
    await processarNotificacaoEfi(token);
  } catch (erro) {
    console.error("[efi] falha ao processar aviso de cobrança:", erro);
    return new Response("erro", { status: 500 });
  }
  return new Response("ok");
}
