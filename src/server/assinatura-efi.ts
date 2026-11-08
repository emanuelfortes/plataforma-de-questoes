import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, like, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { assinaturas, pagamentos } from "@/db/schema";
import { DIAS_PIX, PLANOS, PREFIXO_REFERENCIA, type Plano } from "@/lib/planos";
import { condicoesDaMensal, type DadosPix } from "./assinatura";
import {
  cancelarAssinaturaEfi,
  consultarAssinaturaEfi,
  consultarCobPix,
  consultarCobrancaEfi,
  consultarNotificacaoEfi,
  criarAssinaturaCartao,
  criarCobPix,
  mudarValorAssinaturaEfi,
  qrCodePix,
  type ClienteEfi,
  type CobPix,
  type EnderecoEfi,
} from "./efi";

// Pagamentos novos pela Efí, gravados nas mesmas tabelas do Mercado Pago e com o mesmo vocabulário de status
// (authorized, cancelled, approved...), para o resto do app não precisar saber quem cobrou:
//   - Pix: assinaturas.id = "pix:efi:<txid>" (começa com "pix:", então conta como Pix em todo lugar);
//     pagamentos.id = "efi-pix:<txid>".
//   - Cartão recorrente: assinaturas.id = "efi:<subscription_id>"; pagamentos.id = "efi:<charge_id>".
// Como no Mercado Pago, nunca confiamos no aviso: buscamos sempre o recurso na API da Efí.

const DIA = 24 * 60 * 60 * 1000;
const VALIDADE_QR_SEGUNDOS = 60 * 60;

export const PREFIXO_PIX_EFI = "pix:efi:";
export const PREFIXO_CARTAO_EFI = "efi:";
export const ehPixEfi = (id: string) => id.startsWith(PREFIXO_PIX_EFI);
export const ehCartaoEfi = (id: string) => id.startsWith(PREFIXO_CARTAO_EFI);

const referencia = (usuarioId: string) => `${PREFIXO_REFERENCIA}:${usuarioId}`;
function usuarioDaReferencia(ref: string | null | undefined) {
  const prefixo = `${PREFIXO_REFERENCIA}:`;
  return ref?.startsWith(prefixo) ? ref.slice(prefixo.length) : null;
}

function enderecoSite() {
  return (process.env.BETTER_AUTH_URL || "https://riccardonobrega.com").replace(/\/$/, "");
}

/** URLs dos avisos, com o segredo (a Vercel não faz TLS mútuo; o segredo prova que veio de quem tem a URL). */
export function urlsDeAviso() {
  const segredo = encodeURIComponent(process.env.EFI_WEBHOOK_SEGREDO ?? "");
  const site = enderecoSite();
  return {
    // "ignorar=" no fim: a Efí acrescenta "/pix" à URL, e assim ele cai no parâmetro em vez de mudar o caminho.
    pix: `${site}/api/efi/pix?hmac=${segredo}&ignorar=`,
    cobrancas: `${site}/api/efi/cobrancas?hmac=${segredo}`,
  };
}

/** Datas da API de Cobranças vêm no horário de Brasília sem fuso ("2026-11-08 10:00:00" ou "2026-11-08"). */
function dataEfi(texto: string | null | undefined) {
  if (!texto) return null;
  const [dia, hora = "00:00:00"] = texto.trim().split(/[ T]/);
  const d = new Date(`${dia}T${hora}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------- Pix ----------

function statusDoPix(cob: CobPix) {
  if (cob.status === "CONCLUIDA") {
    const pago = cob.pix?.reduce((s, p) => s + Number(p.valor), 0) ?? 0;
    const devolvido =
      cob.pix?.flatMap((p) => p.devolucoes ?? []).filter((d) => d.status === "DEVOLVIDO").reduce((s, d) => s + Number(d.valor), 0) ?? 0;
    return pago > 0 && devolvido >= pago ? "refunded" : "approved";
  }
  if (cob.status === "ATIVA") {
    // A cobrança vencida continua "ATIVA" na Efí, mas não pode mais ser paga.
    const vence = new Date(cob.calendario.criacao).getTime() + cob.calendario.expiracao * 1000;
    return vence < Date.now() ? "cancelled" : "pending";
  }
  return "cancelled";
}

async function dadosDaCob(cob: CobPix): Promise<DadosPix> {
  if (!cob.loc?.id) throw new Error("A Efí não devolveu o local do QR code.");
  const qr = await qrCodePix(cob.loc.id);
  const imagem = qr.imagemQrcode.startsWith("data:") ? qr.imagemQrcode : `data:image/png;base64,${qr.imagemQrcode}`;
  return { id: `${PREFIXO_PIX_EFI}${cob.txid}`, copiaECola: cob.pixCopiaECola ?? qr.qrcode, imagem, valor: Number(cob.valor.original) };
}

/** Gera o Pix de 30 dias na Efí. O valor vem decidido do servidor (precoDoPix). */
export async function gerarPixEfi(usuarioId: string, valor: number, plano: Plano) {
  const txid = randomUUID().replace(/-/g, ""); // 32 letras e números
  const cob = await criarCobPix(txid, {
    expiracao: VALIDADE_QR_SEGUNDOS,
    valor,
    descricao: `${PLANOS[plano].descricao} (Pix, ${DIAS_PIX} dias)`,
  });
  const agora = new Date();
  await db.insert(assinaturas).values({
    id: `${PREFIXO_PIX_EFI}${txid}`,
    usuarioId,
    status: "pending",
    valorCentavos: Math.round(valor * 100),
    criadaEm: agora,
    atualizadaEm: agora,
  });
  return dadosDaCob(cob);
}

/** QR code de um Pix da Efí ainda aguardando (para reaproveitar em vez de gerar outro). */
export async function dadosDoPixEfi(assinaturaId: string) {
  const cob = await consultarCobPix(assinaturaId.slice(PREFIXO_PIX_EFI.length));
  return statusDoPix(cob) === "pending" ? dadosDaCob(cob) : null;
}

/**
 * Busca o Pix na Efí e atualiza a nossa cópia. Só mexe no que nós geramos (txid desconhecido é de outro produto
 * na mesma conta e é ignorado). Pago, vale 30 dias a partir do fim do acesso que o aluno tinha ao gerar o Pix.
 */
export async function sincronizarPixEfi(txid: string) {
  if (!/^[a-zA-Z0-9]{26,35}$/.test(txid)) return null;
  const id = `${PREFIXO_PIX_EFI}${txid}`;
  const [nossa] = await db.select().from(assinaturas).where(eq(assinaturas.id, id)).limit(1);
  if (!nossa) return null;
  const cob = await consultarCobPix(txid);
  const status = statusDoPix(cob);
  const pagoEm = cob.pix?.[0]?.horario ? new Date(cob.pix[0].horario) : null;
  let acessoAte: Date | null = null;
  if (status === "approved" && pagoEm) {
    // Renovação: o acesso de outro Pix pago gerado antes deste, se ainda valia quando este foi pago.
    const [anterior] = await db
      .select({ acessoAte: assinaturas.acessoAte })
      .from(assinaturas)
      .where(
        and(
          eq(assinaturas.usuarioId, nossa.usuarioId),
          like(assinaturas.id, "pix:%"),
          eq(assinaturas.status, "approved"),
          ne(assinaturas.id, id),
          lt(assinaturas.criadaEm, nossa.criadaEm),
        ),
      )
      .orderBy(desc(assinaturas.acessoAte))
      .limit(1);
    const inicio = anterior?.acessoAte && anterior.acessoAte > pagoEm ? anterior.acessoAte : pagoEm;
    acessoAte = new Date(inicio.getTime() + DIAS_PIX * DIA);
  }
  const agora = new Date();
  await db.update(assinaturas).set({ status, acessoAte, atualizadaEm: agora }).where(eq(assinaturas.id, id));
  if (status === "approved" || status === "refunded") {
    const cobranca = {
      assinaturaId: id,
      usuarioId: nossa.usuarioId,
      valorCentavos: nossa.valorCentavos,
      status,
      cobradoEm: pagoEm ?? agora,
      atualizadoEm: agora,
    };
    await db
      .insert(pagamentos)
      .values({ id: `efi-pix:${txid}`, ...cobranca })
      .onConflictDoUpdate({ target: pagamentos.id, set: cobranca });
  }
  return status;
}

// ---------- Cartão recorrente ----------

/** Situação da cobrança da Efí no vocabulário da tabela pagamentos (o mesmo do Mercado Pago). */
function statusDaCobranca(s: string) {
  if (s === "paid" || s === "settled" || s === "approved") return "approved";
  if (s === "unpaid") return "rejected";
  if (s === "refunded") return "refunded";
  if (s === "contested") return "charged_back";
  if (s === "canceled" || s === "expired") return "cancelled";
  return "pending";
}

/**
 * Busca a assinatura (e as cobranças dela) na Efí e atualiza a nossa cópia.
 * Ativa com a última cobrança recusada vira "paused": o acesso fica só até a data já paga.
 */
export async function sincronizarAssinaturaCartaoEfi(subscriptionId: string) {
  if (!/^\d{1,20}$/.test(subscriptionId)) return null;
  const id = `${PREFIXO_CARTAO_EFI}${subscriptionId}`;
  const s = await consultarAssinaturaEfi(subscriptionId);
  const [nossa] = await db.select().from(assinaturas).where(eq(assinaturas.id, id)).limit(1);
  const usuarioId = usuarioDaReferencia(s.custom_id) ?? nossa?.usuarioId;
  if (!usuarioId) return null; // não é desta plataforma

  const historico = [...(s.history ?? [])].sort((a, b) => (dataEfi(a.created_at)?.getTime() ?? 0) - (dataEfi(b.created_at)?.getTime() ?? 0));
  const ultima = historico.at(-1);
  let status: string;
  if (s.status === "canceled" || s.status === "expired") status = "cancelled";
  else if (s.status === "new") status = "pending";
  else status = ultima && statusDaCobranca(ultima.status) === "rejected" ? "paused" : "authorized";

  // Acesso pago até a próxima cobrança (mais 2 dias para a cobrança do dia cair). Fora de "authorized", mantém o que já era.
  const proxima = dataEfi(s.next_execution);
  const acessoAte = status === "authorized" && proxima ? new Date(proxima.getTime() + 2 * DIA) : (nossa?.acessoAte ?? null);
  const agora = new Date();
  const valores = { usuarioId, status, valorCentavos: Math.round(s.value), acessoAte, atualizadaEm: agora };
  await db
    .insert(assinaturas)
    .values({ id, ...valores, criadaEm: dataEfi(s.created_at) ?? agora })
    .onConflictDoUpdate({ target: assinaturas.id, set: valores });

  for (const h of historico) {
    const pagamentoId = `${PREFIXO_CARTAO_EFI}${h.charge_id}`;
    const [existe] = await db.select({ valor: pagamentos.valorCentavos }).from(pagamentos).where(eq(pagamentos.id, pagamentoId)).limit(1);
    // O valor exato vem da cobrança (pode ter mudado com a troca de plano); só busca as que ainda não temos.
    const valorCentavos = existe?.valor ?? Math.round((await consultarCobrancaEfi(h.charge_id)).total);
    const cobranca = {
      assinaturaId: id,
      usuarioId,
      valorCentavos,
      status: statusDaCobranca(h.status),
      cobradoEm: dataEfi(h.created_at) ?? agora,
      atualizadoEm: agora,
    };
    await db
      .insert(pagamentos)
      .values({ id: pagamentoId, ...cobranca })
      .onConflictDoUpdate({ target: pagamentos.id, set: cobranca });
  }
  return { usuarioId, status, ultimaCobranca: ultima ? statusDaCobranca(ultima.status) : null };
}

export class CartaoRecusadoEfi extends Error {}

/**
 * Cria a assinatura no cartão (token gerado no navegador pelo payment-token-efi). Quem ainda tem acesso pago
 * (Basic, ou reativação) ganha dias grátis até o fim dele, para não pagar duas vezes. Se a 1ª cobrança for
 * recusada, a assinatura é cancelada na hora e o erro sobe como CartaoRecusadoEfi.
 */
export async function assinarComCartaoEfi(
  usuarioId: string,
  dados: { token: string; cliente: ClienteEfi; endereco: EnderecoEfi },
  plano: Plano,
) {
  const { valor, inicio } = await condicoesDaMensal(usuarioId, plano);
  const diasGratis = inicio ? Math.ceil((inicio.getTime() - Date.now()) / DIA) : 0;
  const r = await criarAssinaturaCartao({
    nomeItem: PLANOS[plano].descricao,
    centavos: Math.round(valor * 100),
    referencia: referencia(usuarioId),
    // Em localhost não há como receber o aviso (e a Efí pode recusar URL sem https): a tela e o cron conferem.
    urlAviso: urlsDeAviso().cobrancas.startsWith("https://") ? urlsDeAviso().cobrancas : undefined,
    token: dados.token,
    cliente: dados.cliente,
    endereco: dados.endereco,
    diasGratis: diasGratis > 0 ? diasGratis : undefined,
  });
  const id = String(r.subscription_id);
  const situacao = await sincronizarAssinaturaCartaoEfi(id);
  const recusada = r.charge?.status === "unpaid" || situacao?.ultimaCobranca === "rejected";
  if (recusada) {
    await cancelarAssinaturaEfi(id).catch((erro) => console.error("[efi] falha ao cancelar assinatura recusada:", erro));
    await sincronizarAssinaturaCartaoEfi(id).catch(() => null);
    throw new CartaoRecusadoEfi("Primeira cobrança recusada.");
  }
  return situacao?.status ?? "pending";
}

export async function cancelarAssinaturaCartaoEfi(assinaturaId: string) {
  const id = assinaturaId.slice(PREFIXO_CARTAO_EFI.length);
  await cancelarAssinaturaEfi(id);
  await sincronizarAssinaturaCartaoEfi(id);
}

export async function mudarValorCartaoEfi(assinaturaId: string, plano: Plano, centavos: number) {
  const id = assinaturaId.slice(PREFIXO_CARTAO_EFI.length);
  await mudarValorAssinaturaEfi(id, PLANOS[plano].descricao, centavos);
  await sincronizarAssinaturaCartaoEfi(id);
}

/** Aviso da API de Cobranças: busca as mudanças pelo token e atualiza cada assinatura citada. */
export async function processarNotificacaoEfi(token: string) {
  const mudancas = await consultarNotificacaoEfi(token);
  const ids = new Set<string>();
  for (const m of mudancas) {
    if (m.identifiers?.subscription_id) ids.add(String(m.identifiers.subscription_id));
    else if (m.identifiers?.charge_id) {
      const c = await consultarCobrancaEfi(m.identifiers.charge_id);
      if (c.subscription?.subscription_id) ids.add(String(c.subscription.subscription_id));
    }
  }
  for (const id of ids) await sincronizarAssinaturaCartaoEfi(id);
  return ids.size;
}
