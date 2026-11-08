import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Confere o segredo que cadastramos na URL dos avisos da Efí (?hmac=...). A Vercel não faz TLS mútuo, então é
 * ele que separa o aviso da Efí de qualquer outro. Mesmo assim, nada do conteúdo é usado: só o id, e o recurso
 * é buscado na API com o nosso acesso.
 */
export function avisoAutorizado(url: URL) {
  const segredo = process.env.EFI_WEBHOOK_SEGREDO;
  const recebido = url.searchParams.get("hmac");
  if (!segredo || !recebido) return false;
  const a = Buffer.from(segredo);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}
