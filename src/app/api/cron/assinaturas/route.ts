import { timingSafeEqual } from "node:crypto";
import { cobrancaAtiva, sincronizarTodas } from "@/server/assinatura";

// Conferência diária das assinaturas no Mercado Pago (agendada em vercel.json).
// A Vercel chama com "Authorization: Bearer <CRON_SECRET>"; sem o segredo certo, nada roda.
export const maxDuration = 60;

function autorizado(cabecalho: string | null) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || !cabecalho) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(cabecalho);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

export async function GET(requisicao: Request) {
  if (!autorizado(requisicao.headers.get("authorization"))) {
    return new Response("não autorizado", { status: 401 });
  }
  if (!cobrancaAtiva()) return Response.json({ ok: true, motivo: "cobrança desligada" });
  const resultado = await sincronizarTodas();
  return Response.json({ ok: true, ...resultado });
}
