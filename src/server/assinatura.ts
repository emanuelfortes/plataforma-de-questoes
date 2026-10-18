import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { Invoice, MercadoPagoConfig, PreApproval } from "mercadopago";
import { db } from "@/db";
import { assinaturas, pagamentos, respostas, user } from "@/db/schema";
import { inicioDoDiaLocal } from "@/lib/datas";
import { ASSINATURA, PREFIXO_REFERENCIA } from "@/lib/planos";
import { ehAdmin } from "@/lib/admin";

// Assinatura mensal pelo Mercado Pago (preapproval sem plano, status "pending"): o aluno é levado
// ao checkout do Mercado Pago (init_point), cadastra o cartão e as cobranças seguem sozinhas.
// Tudo que chega (webhook ou retorno do checkout) é conferido de novo na API com o nosso token.

function cliente() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN não configurado.");
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
}

function enderecoSite() {
  return (process.env.BETTER_AUTH_URL || "https://riccardonobrega.com").replace(/\/$/, "");
}

const referencia = (usuarioId: string) => `${PREFIXO_REFERENCIA}:${usuarioId}`;

/** usuarioId a partir do external_reference, só se for desta plataforma. */
function usuarioDaReferencia(ref: string | undefined) {
  const prefixo = `${PREFIXO_REFERENCIA}:`;
  return ref?.startsWith(prefixo) ? ref.slice(prefixo.length) : null;
}

const centavos = (valor: number | undefined) => Math.round((valor ?? 0) * 100);
const data = (iso: string | undefined | null) => (iso ? new Date(iso) : null);

/** Cria a assinatura no Mercado Pago e devolve o link do checkout. */
export async function criarCheckout(usuario: { id: string; email: string }) {
  const resposta = await new PreApproval(cliente()).create({
    body: {
      reason: ASSINATURA.descricao,
      external_reference: referencia(usuario.id),
      payer_email: usuario.email,
      back_url: `${enderecoSite()}/assinatura`,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: ASSINATURA.valor,
        currency_id: "BRL",
      },
    },
  });
  if (!resposta.id || !resposta.init_point) throw new Error("O Mercado Pago não devolveu o link de pagamento.");
  await salvarAssinatura(resposta);
  return resposta.init_point;
}

type AssinaturaMP = Awaited<ReturnType<PreApproval["get"]>>;

async function salvarAssinatura(a: AssinaturaMP) {
  const usuarioId = usuarioDaReferencia(a.external_reference);
  if (!a.id || !usuarioId) return null; // não é desta plataforma
  const agora = new Date();
  const proxima = data(a.next_payment_date);
  const valores = {
    usuarioId,
    status: a.status ?? "pending",
    valorCentavos: centavos(a.auto_recurring?.transaction_amount),
    // Enquanto ativa, o acesso vale até a próxima cobrança; ao cancelar, mantém a última data paga.
    ...(a.status === "authorized" && proxima ? { acessoAte: proxima } : {}),
    atualizadaEm: agora,
  };
  await db
    .insert(assinaturas)
    .values({ id: a.id, ...valores, criadaEm: data(a.date_created) ?? agora })
    .onConflictDoUpdate({ target: assinaturas.id, set: valores });
  return usuarioId;
}

/** Busca a assinatura no Mercado Pago e atualiza a nossa cópia. */
export async function sincronizarAssinatura(id: string) {
  const a = await new PreApproval(cliente()).get({ id });
  return salvarAssinatura(a);
}

/** Busca uma cobrança mensal (authorized_payment) e grava no histórico de faturamento. */
export async function sincronizarPagamento(id: string) {
  const p = await new Invoice(cliente()).get({ id });
  if (!p.id || !p.preapproval_id) return;
  // A cobrança só é desta plataforma se a assinatura for (o aviso pode chegar antes dela).
  const usuarioId = (await sincronizarAssinatura(p.preapproval_id)) ?? null;
  if (!usuarioId) return;
  const agora = new Date();
  const valores = {
    assinaturaId: p.preapproval_id,
    usuarioId,
    valorCentavos: centavos(p.transaction_amount),
    status: p.payment?.status ?? p.status ?? "pending",
    cobradoEm: data(p.debit_date) ?? data(p.date_created) ?? agora,
    atualizadoEm: agora,
  };
  await db
    .insert(pagamentos)
    .values({ id: String(p.id), ...valores })
    .onConflictDoUpdate({ target: pagamentos.id, set: valores });
}

export async function cancelarAssinatura(id: string) {
  await new PreApproval(cliente()).update({ id, body: { status: "cancelled" } });
  await sincronizarAssinatura(id);
}

/** Assinatura mais recente do aluno (ou null). */
export async function assinaturaDoUsuario(usuarioId: string) {
  const [a] = await db
    .select()
    .from(assinaturas)
    .where(eq(assinaturas.usuarioId, usuarioId))
    .orderBy(desc(assinaturas.atualizadaEm))
    .limit(1);
  return a ?? null;
}

/** Acesso liberado: assinatura ativa, ou cancelada mas ainda dentro do período pago. */
export function acessoLiberado(a: Awaited<ReturnType<typeof assinaturaDoUsuario>>) {
  if (!a) return false;
  if (a.status === "authorized") return true;
  return !!a.acessoAte && a.acessoAte.getTime() > Date.now();
}

/** A cobrança só liga quando o Mercado Pago está configurado: antes disso ninguém tem limite. */
export function cobrancaAtiva() {
  return !!process.env.MP_ACCESS_TOKEN;
}

/** Situação do aluno para o limite diário. O dono (ADMIN_EMAILS) nunca tem limite. */
export async function situacaoDoAluno(usuario: { id: string; email: string }) {
  if (!cobrancaAtiva() || ehAdmin(usuario.email)) return { assinante: true, respondidasHoje: 0 };
  const [a, [hoje]] = await Promise.all([
    assinaturaDoUsuario(usuario.id),
    // Usa o índice (usuario_id, respondida_em): lê só as respostas de hoje do aluno.
    db
      .select({ n: count() })
      .from(respostas)
      .where(and(eq(respostas.usuarioId, usuario.id), gte(respostas.respondidaEm, inicioDoDiaLocal()))),
  ]);
  return { assinante: acessoLiberado(a), respondidasHoje: hoje?.n ?? 0 };
}

/** Números do painel de faturamento do dono. Lê só as tabelas de assinatura e pagamento. */
export async function resumoFaturamento() {
  const [ativas, porMes, ultimos, porStatus] = await Promise.all([
    db
      .select({ n: count(), mrr: sql<number>`coalesce(sum(${assinaturas.valorCentavos}), 0)` })
      .from(assinaturas)
      .where(eq(assinaturas.status, "authorized")),
    db.all<{ mes: string; total: number; quantidade: number }>(sql`
      SELECT strftime('%Y-%m', ${pagamentos.cobradoEm}, 'unixepoch', '-3 hours') AS mes,
             SUM(${pagamentos.valorCentavos}) AS total, COUNT(*) AS quantidade
      FROM ${pagamentos} WHERE ${pagamentos.status} = 'approved'
      GROUP BY mes ORDER BY mes DESC LIMIT 12`),
    db
      .select({
        id: pagamentos.id,
        valorCentavos: pagamentos.valorCentavos,
        status: pagamentos.status,
        cobradoEm: pagamentos.cobradoEm,
        nome: user.name,
        email: user.email,
      })
      .from(pagamentos)
      .leftJoin(user, eq(user.id, pagamentos.usuarioId))
      .orderBy(desc(pagamentos.cobradoEm))
      .limit(30),
    db.select({ status: assinaturas.status, n: count() }).from(assinaturas).groupBy(assinaturas.status),
  ]);
  return {
    assinantesAtivos: ativas[0]?.n ?? 0,
    mrrCentavos: Number(ativas[0]?.mrr ?? 0),
    porMes,
    ultimos,
    porStatus: Object.fromEntries(porStatus.map((s) => [s.status, s.n])) as Record<string, number>,
  };
}

/** Cancela no Mercado Pago as assinaturas que ainda cobrariam o aluno (usado ao excluir a conta). */
export async function cancelarAssinaturasDoUsuario(usuarioId: string) {
  const lista = await db.select().from(assinaturas).where(eq(assinaturas.usuarioId, usuarioId));
  for (const a of lista) {
    if (a.status === "authorized" || a.status === "pending" || a.status === "paused") await cancelarAssinatura(a.id);
  }
}
