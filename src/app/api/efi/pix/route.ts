import { sincronizarPixEfi } from "@/server/assinatura-efi";
import { avisoAutorizado } from "@/server/aviso-efi";

// Avisos de Pix recebido na chave da Efí. Cadastrado por scripts/efi/configurar-webhook.ts com a URL
// https://<site>/api/efi/pix?hmac=<EFI_WEBHOOK_SEGREDO>&ignorar= (a Efí acrescenta "/pix" no fim, que cai no "ignorar").
// Pix que não é nosso (txid desconhecido, ou Pix direto na chave) é ignorado.
export const maxDuration = 30;

export async function POST(requisicao: Request) {
  const url = new URL(requisicao.url);
  if (!avisoAutorizado(url)) {
    console.warn("[efi] aviso de Pix sem o segredo certo, ip:", requisicao.headers.get("x-forwarded-for"));
    return new Response("não autorizado", { status: 401 });
  }
  const corpo = (await requisicao.json().catch(() => ({}))) as { pix?: { txid?: string }[] };
  const txids = [...new Set((corpo.pix ?? []).map((p) => p.txid).filter((t): t is string => !!t))];
  try {
    for (const txid of txids) await sincronizarPixEfi(txid);
  } catch (erro) {
    // Erro faz a Efí tentar de novo mais tarde.
    console.error("[efi] falha ao processar aviso de Pix:", txids, erro);
    return new Response("erro", { status: 500 });
  }
  return new Response("ok");
}
