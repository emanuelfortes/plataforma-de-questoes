import "server-only";
import { and, between, count, countDistinct, desc, eq, gt, gte, like, ne, or, sql } from "drizzle-orm";
import { Invoice, MercadoPagoConfig, Payment, PreApproval } from "mercadopago";
import { db } from "@/db";
import { assinaturas, pagamentos, respostas, user } from "@/db/schema";
import { DESLOCAMENTO_SQLITE, inicioDoDiaLocal } from "@/lib/datas";
import { DIAS_PIX, formatarReais, PLANOS, precoDoPlano, PREFIXO_PIX, PREFIXO_REFERENCIA, valorAoTrocar, valorEhElite, type Plano } from "@/lib/planos";
import { ehAdmin } from "@/lib/admin";
import { emailRenovarPix, enviarEmail } from "./email";

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

/**
 * Cobrança mensal do aluno, no preço de hoje (promocional em novembro: fica gravado na assinatura). No Basic,
 * o início é adiado se ele ainda tem acesso pago (cancelou e voltou dentro do período): a 1ª cobrança cai no
 * dia em que o acesso atual acaba, sem pagar duas vezes. O Elite começa a cobrar na hora.
 */
async function cobrancaMensal(usuarioId: string, plano: Plano) {
  const atual = plano === "basico" ? await assinaturaDoUsuario(usuarioId) : null;
  const inicio = atual?.acessoAte && atual.acessoAte.getTime() > Date.now() + 60 * 60 * 1000 ? atual.acessoAte : null;
  return {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: precoDoPlano(plano),
    currency_id: "BRL",
    ...(inicio ? { start_date: inicio.toISOString() } : {}),
  };
}

/** Cria a assinatura no Mercado Pago e devolve o link do checkout. */
export async function criarCheckout(usuario: { id: string; email: string }, plano: Plano = "basico") {
  const resposta = await new PreApproval(cliente()).create({
    body: {
      reason: PLANOS[plano].descricao,
      external_reference: referencia(usuario.id),
      payer_email: usuario.email,
      back_url: `${enderecoSite()}/assinatura`,
      status: "pending",
      auto_recurring: await cobrancaMensal(usuario.id, plano),
    },
  });
  if (!resposta.id || !resposta.init_point) throw new Error("O Mercado Pago não devolveu o link de pagamento.");
  await salvarAssinatura(resposta);
  return resposta.init_point;
}

/**
 * Checkout transparente: o aluno digita o cartão no nosso site (formulário do Mercado Pago, que devolve
 * só um token; o número do cartão nunca passa pelo nosso servidor). A assinatura já nasce "authorized"
 * e a primeira cobrança sai na hora. Erro de cartão recusado vem como exceção da API.
 */
export async function assinarComCartao(usuario: { id: string }, cartao: { token: string; email: string }, plano: Plano = "basico") {
  const resposta = await new PreApproval(cliente()).create({
    body: {
      reason: PLANOS[plano].descricao,
      external_reference: referencia(usuario.id),
      payer_email: cartao.email,
      card_token_id: cartao.token,
      back_url: `${enderecoSite()}/assinatura`,
      status: "authorized",
      auto_recurring: await cobrancaMensal(usuario.id, plano),
    },
  });
  if (!resposta.id) throw new Error("O Mercado Pago não devolveu a assinatura.");
  await salvarAssinatura(resposta);
  return resposta.status ?? "pending";
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
  await salvarPagamento(p, usuarioId);
}

type CobrancaMP = Awaited<ReturnType<Invoice["get"]>>;

async function salvarPagamento(p: CobrancaMP, usuarioId: string) {
  if (!p.id || !p.preapproval_id) return;
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

/**
 * Conferência diária (cron): atualiza no Mercado Pago todas as assinaturas que ainda importam
 * e as cobranças de cada uma. Garante renovações, recusas e cancelamentos mesmo sem webhook
 * (a conta do Mercado Pago é compartilhada e o webhook dela aponta para outro produto).
 */
export async function sincronizarTodas() {
  const umMesAtras = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
  const lista = await db
    .select({ id: assinaturas.id, usuarioId: assinaturas.usuarioId, status: assinaturas.status, criadaEm: assinaturas.criadaEm })
    .from(assinaturas)
    .where(or(ne(assinaturas.status, "cancelled"), gte(assinaturas.atualizadaEm, umMesAtras)));
  const faturas = new Invoice(cliente());
  let cobrancas = 0;
  const falhas: string[] = [];
  for (const a of lista) {
    try {
      if (ehPix(a.id)) {
        // Pix: confere enquanto aguarda o pagamento e por 40 dias depois (estorno, contestação).
        if (a.status !== "approved" || a.criadaEm.getTime() > Date.now() - 40 * DIA) await sincronizarPix(a.id.slice(4));
        continue;
      }
      await sincronizarAssinatura(a.id);
      const r = await faturas.search({ options: { preapproval_id: a.id, limit: 50 } });
      for (const p of r.results ?? []) {
        await salvarPagamento(p, a.usuarioId);
        cobrancas++;
      }
    } catch (erro) {
      console.error(`[assinatura] falha ao conferir ${a.id}:`, erro);
      falhas.push(a.id);
    }
  }
  let avisos = 0;
  try {
    avisos = await avisarFimDoPix();
  } catch (erro) {
    console.error("[assinatura] falha nos avisos do Pix:", erro);
    falhas.push("avisos-pix");
  }
  return { assinaturas: lista.length, cobrancas, avisos, falhas };
}

// ---------- Pix (30 dias por pagamento, sem renovação automática) ----------
// Cada Pix fica na tabela "assinaturas" com id "pix:<id do pagamento>" e o status do pagamento
// (pending, approved...), e na tabela "pagamentos" para o faturamento. Pago, vale 30 dias a partir do
// fim do acesso atual (renovar antes de acabar não perde dias). Perto do fim, o aluno recebe um e-mail.

const DIA = 24 * 60 * 60 * 1000;
/** Depois de vencer, o aluno ainda tem estes dias para renovar no mesmo preço (o da Black Friday, por exemplo). */
const CARENCIA_PRECO = 7 * DIA;
const VALIDADE_QR = 60 * 60 * 1000;

export const ehPix = (id: string) => id.startsWith("pix:");
const referenciaPix = (usuarioId: string) => `${PREFIXO_PIX}:${usuarioId}`;
const usuarioDoPix = (ref: string | undefined) => (ref?.startsWith(`${PREFIXO_PIX}:`) ? ref.slice(PREFIXO_PIX.length + 1) : null);

/** Último Pix pago do aluno (o de acesso mais longo). */
async function ultimoPixPago(usuarioId: string) {
  const [a] = await db
    .select()
    .from(assinaturas)
    .where(and(eq(assinaturas.usuarioId, usuarioId), like(assinaturas.id, "pix:%"), eq(assinaturas.status, "approved")))
    .orderBy(desc(assinaturas.acessoAte))
    .limit(1);
  return a ?? null;
}

/**
 * Preço do próximo Pix: quem renova em dia (ou até 7 dias depois de vencer) mantém o preço que já paga, com
 * a Tropa de Elite somada ou tirada; quem volta depois disso paga o preço de hoje.
 */
export async function precoDoPix(usuarioId: string, plano: Plano) {
  const ultimo = await ultimoPixPago(usuarioId);
  if (ultimo?.acessoAte && ultimo.acessoAte.getTime() > Date.now() - CARENCIA_PRECO) {
    return valorAoTrocar(ultimo.valorCentavos, plano) / 100;
  }
  return precoDoPlano(plano);
}

type PagamentoMP = Awaited<ReturnType<Payment["get"]>>;

/** Dados para a tela: QR code (imagem), copia e cola e validade. */
function dadosDoPix(p: PagamentoMP) {
  const t = p.point_of_interaction?.transaction_data;
  if (!p.id || !t?.qr_code || !t.qr_code_base64) throw new Error("O Mercado Pago não devolveu o QR code do Pix.");
  return {
    id: String(p.id),
    copiaECola: t.qr_code,
    imagem: `data:image/png;base64,${t.qr_code_base64}`,
    valor: p.transaction_amount ?? 0,
  };
}

export type DadosPix = ReturnType<typeof dadosDoPix>;

/** Grava o Pix (e a cobrança, para o faturamento). Estorno ou recusa tiram o acesso. */
async function salvarPix(p: PagamentoMP) {
  const usuarioId = usuarioDoPix(p.external_reference);
  if (!p.id || !usuarioId) return null; // não é desta plataforma
  const [existe] = await db.select({ id: user.id }).from(user).where(eq(user.id, usuarioId)).limit(1);
  if (!existe) return null;
  const agora = new Date();
  const status = p.status ?? "pending";
  const aprovado = data(p.date_approved);
  // Renovação: os 30 dias novos começam quando o acesso que o aluno tinha ao gerar o Pix acaba.
  const inicioCombinado = data((p.metadata as { inicio?: string } | undefined)?.inicio);
  const inicio = aprovado && inicioCombinado && inicioCombinado > aprovado ? inicioCombinado : aprovado;
  const valorCentavos = centavos(p.transaction_amount);
  const id = `pix:${p.id}`;
  const valores = {
    usuarioId,
    status,
    valorCentavos,
    acessoAte: status === "approved" && inicio ? new Date(inicio.getTime() + DIAS_PIX * DIA) : null,
    atualizadaEm: agora,
  };
  await db
    .insert(assinaturas)
    .values({ id, ...valores, criadaEm: data(p.date_created) ?? agora })
    .onConflictDoUpdate({ target: assinaturas.id, set: valores });
  // Pix gerado e não pago (aguardando ou expirado) não é cobrança: fica fora do faturamento.
  if (status === "pending" || status === "cancelled") return usuarioId;
  const cobranca = { assinaturaId: id, usuarioId, valorCentavos, status, cobradoEm: aprovado ?? data(p.date_created) ?? agora, atualizadoEm: agora };
  await db
    .insert(pagamentos)
    .values({ id: String(p.id), ...cobranca })
    .onConflictDoUpdate({ target: pagamentos.id, set: cobranca });
  return usuarioId;
}

/** Busca o Pix no Mercado Pago e atualiza a nossa cópia (ignora o que não é desta plataforma). */
export async function sincronizarPix(id: string) {
  const p = await new Payment(cliente()).get({ id });
  await salvarPix(p);
  return p;
}

/**
 * Gera o Pix de 30 dias (ou devolve o que o aluno gerou há pouco, no mesmo valor, ainda sem pagar).
 * O valor sai do servidor (precoDoPix); o aviso do pagamento vem direto para o nosso webhook.
 */
export async function gerarPix(usuario: { id: string; email: string }, plano: Plano) {
  const valor = await precoDoPix(usuario.id, plano);
  const [pendente] = await db
    .select({ id: assinaturas.id })
    .from(assinaturas)
    .where(
      and(
        eq(assinaturas.usuarioId, usuario.id),
        like(assinaturas.id, "pix:%"),
        eq(assinaturas.status, "pending"),
        eq(assinaturas.valorCentavos, Math.round(valor * 100)),
        // Sobram pelo menos 10 minutos para pagar.
        gt(assinaturas.criadaEm, new Date(Date.now() - VALIDADE_QR + 10 * 60 * 1000)),
      ),
    )
    .orderBy(desc(assinaturas.criadaEm))
    .limit(1);
  if (pendente) {
    const p = await sincronizarPix(pendente.id.slice(4));
    if (p.status === "pending") return dadosDoPix(p);
  }
  const atual = await ultimoPixPago(usuario.id);
  const inicio = atual?.acessoAte && atual.acessoAte.getTime() > Date.now() ? atual.acessoAte.toISOString() : undefined;
  const site = enderecoSite();
  const p = await new Payment(cliente()).create({
    body: {
      transaction_amount: valor,
      description: `${PLANOS[plano].descricao} (Pix, ${DIAS_PIX} dias)`,
      payment_method_id: "pix",
      payer: { email: usuario.email },
      external_reference: referenciaPix(usuario.id),
      date_of_expiration: new Date(Date.now() + VALIDADE_QR).toISOString(),
      metadata: inicio ? { inicio } : {},
      // Aviso do pagamento direto para nós (o webhook da conta aponta para outro produto). Só em https.
      ...(site.startsWith("https://") ? { notification_url: `${site}/api/mercadopago/webhook` } : {}),
    },
    requestOptions: { idempotencyKey: crypto.randomUUID() },
  });
  await salvarPix(p);
  return dadosDoPix(p);
}

/** Pix ainda aguardando pagamento do aluno (confere ao abrir a tela de assinatura). */
export async function atualizarPixPendentes(usuarioId: string) {
  const lista = await db
    .select({ id: assinaturas.id })
    .from(assinaturas)
    .where(and(eq(assinaturas.usuarioId, usuarioId), like(assinaturas.id, "pix:%"), eq(assinaturas.status, "pending")))
    .limit(5);
  for (const a of lista) await sincronizarPix(a.id.slice(4)).catch((erro) => console.error("[pix] conferência:", erro));
}

/** E-mail 2 a 3 dias antes do fim do acesso pago no Pix (o cron roda 1x por dia, então sai um só). */
async function avisarFimDoPix() {
  const agora = Date.now();
  const lista = await db
    .select({ usuarioId: assinaturas.usuarioId, acessoAte: assinaturas.acessoAte, valorCentavos: assinaturas.valorCentavos, nome: user.name, email: user.email })
    .from(assinaturas)
    .innerJoin(user, eq(user.id, assinaturas.usuarioId))
    .where(and(like(assinaturas.id, "pix:%"), eq(assinaturas.status, "approved"), between(assinaturas.acessoAte, new Date(agora + 2 * DIA), new Date(agora + 3 * DIA))));
  let enviados = 0;
  for (const c of lista) {
    const atual = await assinaturaDoUsuario(c.usuarioId);
    // Já renovou (outro Pix mais longo) ou assinou no cartão.
    if (atual?.status === "authorized" || (atual?.acessoAte && c.acessoAte && atual.acessoAte > c.acessoAte)) continue;
    const fim = c.acessoAte!.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    await enviarEmail({ para: c.email, ...emailRenovarPix(c.nome, fim, formatarReais(c.valorCentavos / 100), `${enderecoSite()}/assinatura`) });
    enviados++;
  }
  return enviados;
}

export async function cancelarAssinatura(id: string) {
  await new PreApproval(cliente()).update({ id, body: { status: "cancelled" } });
  await sincronizarAssinatura(id);
}

/**
 * A assinatura que vale para o aluno (ou null): a mensal ativa; senão, a de acesso pago mais longo (cancelada
 * no período); senão, a mais recente. Assim um checkout abandonado não esconde o período já pago.
 */
export async function assinaturaDoUsuario(usuarioId: string) {
  const [a] = await db
    .select()
    .from(assinaturas)
    .where(eq(assinaturas.usuarioId, usuarioId))
    .orderBy(sql`case when ${assinaturas.status} = 'authorized' then 0 else 1 end`, desc(assinaturas.acessoAte), desc(assinaturas.atualizadaEm))
    .limit(1);
  return a ?? null;
}

/** Acesso liberado: assinatura ativa, ou cancelada mas ainda dentro do período pago. */
export function acessoLiberado(a: Awaited<ReturnType<typeof assinaturaDoUsuario>>) {
  if (!a) return false;
  if (a.status === "authorized") return true;
  return !!a.acessoAte && a.acessoAte.getTime() > Date.now();
}

/** Elite: mensal paga com valor de Elite (ativa, ou cancelada ainda no período). */
export function eliteLiberado(a: Awaited<ReturnType<typeof assinaturaDoUsuario>>) {
  return !!a && acessoLiberado(a) && valorEhElite(a.valorCentavos);
}

/** Simulados: Elite, o dono e, com a cobrança desligada, todo mundo. */
export async function temElite(usuario: { id: string; email: string }) {
  if (!cobrancaAtiva() || ehAdmin(usuario.email)) return true;
  return eliteLiberado(await assinaturaDoUsuario(usuario.id));
}

/**
 * Troca de plano na mesma assinatura (o Mercado Pago deixa mudar só o valor): soma ou tira o adicional da
 * Tropa de Elite do valor que o aluno já paga, então o preço da Black Friday continua valendo. Vale a partir
 * da próxima cobrança; quem inclui a Tropa de Elite já ganha os simulados agora.
 */
export async function mudarPlano(id: string, centavosAtuais: number, plano: Plano) {
  const novo = valorAoTrocar(centavosAtuais, plano);
  if (novo === centavosAtuais) return;
  await new PreApproval(cliente()).update({
    id,
    body: { reason: PLANOS[plano].descricao, auto_recurring: { transaction_amount: novo / 100, currency_id: "BRL" } },
  });
  await sincronizarAssinatura(id);
}

/** A cobrança só liga quando o Mercado Pago está configurado: antes disso ninguém tem limite. */
export function cobrancaAtiva() {
  return !!process.env.MP_ACCESS_TOKEN;
}

/**
 * Flashcards e desempenho são só de assinantes. Liberado também para o dono e enquanto a cobrança
 * estiver desligada (mesma regra do limite diário). Lê só a assinatura do aluno.
 */
export async function temAcessoCompleto(usuario: { id: string; email: string }) {
  if (!cobrancaAtiva() || ehAdmin(usuario.email)) return true;
  return acessoLiberado(await assinaturaDoUsuario(usuario.id));
}

/** Situação do aluno para o limite diário. O dono (ADMIN_EMAILS) nunca tem limite. */
export async function situacaoDoAluno(usuario: { id: string; email: string }) {
  if (!cobrancaAtiva() || ehAdmin(usuario.email)) return { assinante: true, respondidasHoje: 0 };
  const [a, [hoje]] = await Promise.all([
    assinaturaDoUsuario(usuario.id),
    // Usa o índice (usuario_id, respondida_em): lê só as respostas de hoje do aluno. Conta questões
    // diferentes: refazer (ou a revisão da questão errada) não gasta o limite grátis.
    db
      .select({ n: countDistinct(respostas.questaoId) })
      .from(respostas)
      .where(and(eq(respostas.usuarioId, usuario.id), gte(respostas.respondidaEm, inicioDoDiaLocal()))),
  ]);
  return { assinante: acessoLiberado(a), respondidasHoje: hoje?.n ?? 0 };
}

/** O aluno já respondeu esta questão hoje? (refazer no limite diário). Índice (usuario_id, respondida_em). */
export async function respondeuHoje(usuarioId: string, questaoId: number) {
  const [r] = await db
    .select({ id: respostas.id })
    .from(respostas)
    .where(and(eq(respostas.usuarioId, usuarioId), gte(respostas.respondidaEm, inicioDoDiaLocal()), eq(respostas.questaoId, questaoId)))
    .limit(1);
  return !!r;
}

export type FormaPagamento = "pix" | "cartao";

/** Pix ou cartão, pelo id da assinatura ("pix:<pagamento>" é Pix; o resto é a mensal no cartão). */
const formaDaAssinatura = sql<FormaPagamento>`case when ${pagamentos.assinaturaId} like 'pix:%' then 'pix' else 'cartao' end`;

/**
 * Números do painel de faturamento do dono. Lê só as tabelas de assinatura e pagamento.
 * `forma` filtra a lista das últimas cobranças (Pix ou cartão).
 */
export async function resumoFaturamento(forma?: FormaPagamento) {
  const [ativas, porMes, ultimos, porStatus, porForma, ativosPorForma] = await Promise.all([
    db
      .select({ n: count(), mrr: sql<number>`coalesce(sum(${assinaturas.valorCentavos}), 0)` })
      .from(assinaturas)
      .where(
        or(
          eq(assinaturas.status, "authorized"),
          // Pix pago e ainda valendo: conta só o de acesso mais longo de cada aluno (renovou antes de acabar).
          sql`${assinaturas.id} like 'pix:%' and ${assinaturas.status} = 'approved' and ${assinaturas.acessoAte} > unixepoch()
            and not exists (select 1 from assinaturas b where b.usuario_id = ${assinaturas.usuarioId} and b.id like 'pix:%'
              and b.status = 'approved' and b.acesso_ate > ${assinaturas.acessoAte})`,
        ),
      ),
    db.all<{ mes: string; total: number; quantidade: number }>(sql`
      SELECT strftime('%Y-%m', ${pagamentos.cobradoEm}, 'unixepoch', '-3 hours') AS mes,
             SUM(${pagamentos.valorCentavos}) AS total, COUNT(*) AS quantidade
      FROM ${pagamentos} WHERE ${pagamentos.status} = 'approved'
      GROUP BY mes ORDER BY mes DESC LIMIT 12`),
    db
      .select({
        id: pagamentos.id,
        assinaturaId: pagamentos.assinaturaId,
        valorCentavos: pagamentos.valorCentavos,
        status: pagamentos.status,
        cobradoEm: pagamentos.cobradoEm,
        nome: user.name,
        email: user.email,
      })
      .from(pagamentos)
      .leftJoin(user, eq(user.id, pagamentos.usuarioId))
      .where(forma ? sql`${formaDaAssinatura} = ${forma}` : undefined)
      .orderBy(desc(pagamentos.cobradoEm))
      .limit(50),
    // Só assinaturas no cartão: um Pix expirado sem pagar não é cancelamento.
    db
      .select({ status: assinaturas.status, n: count() })
      .from(assinaturas)
      .where(sql`${assinaturas.id} not like 'pix:%'`)
      .groupBy(assinaturas.status),
    // Recebido (aprovado) por forma de pagamento: no mês atual (fuso de Brasília) e desde o início.
    db.all<{ forma: FormaPagamento; mes: number; quantidadeMes: number; total: number; quantidade: number }>(sql`
      SELECT ${formaDaAssinatura} AS forma,
             SUM(CASE WHEN strftime('%Y-%m', ${pagamentos.cobradoEm}, 'unixepoch', ${DESLOCAMENTO_SQLITE})
                         = strftime('%Y-%m', 'now', ${DESLOCAMENTO_SQLITE}) THEN ${pagamentos.valorCentavos} ELSE 0 END) AS mes,
             SUM(CASE WHEN strftime('%Y-%m', ${pagamentos.cobradoEm}, 'unixepoch', ${DESLOCAMENTO_SQLITE})
                         = strftime('%Y-%m', 'now', ${DESLOCAMENTO_SQLITE}) THEN 1 ELSE 0 END) AS quantidadeMes,
             SUM(${pagamentos.valorCentavos}) AS total, COUNT(*) AS quantidade
      FROM ${pagamentos} WHERE ${pagamentos.status} = 'approved'
      GROUP BY forma`),
    // Assinantes com acesso pago agora: cartão (mensal ativa) e Pix (pago e ainda valendo).
    db.all<{ cartao: number; pix: number }>(sql`
      SELECT (SELECT COUNT(*) FROM ${assinaturas} WHERE ${assinaturas.status} = 'authorized') AS cartao,
             (SELECT COUNT(DISTINCT ${assinaturas.usuarioId}) FROM ${assinaturas}
               WHERE ${assinaturas.id} LIKE 'pix:%' AND ${assinaturas.status} = 'approved' AND ${assinaturas.acessoAte} > unixepoch()) AS pix`),
  ]);
  const vazio = { mes: 0, quantidadeMes: 0, total: 0, quantidade: 0 };
  const daForma = (f: FormaPagamento) => {
    const l = porForma.find((x) => x.forma === f);
    return l ? { mes: Number(l.mes), quantidadeMes: Number(l.quantidadeMes), total: Number(l.total), quantidade: Number(l.quantidade) } : vazio;
  };
  return {
    assinantesAtivos: ativas[0]?.n ?? 0,
    mrrCentavos: Number(ativas[0]?.mrr ?? 0),
    porMes,
    ultimos,
    porStatus: Object.fromEntries(porStatus.map((s) => [s.status, s.n])) as Record<string, number>,
    porForma: {
      pix: { ...daForma("pix"), ativos: Number(ativosPorForma[0]?.pix ?? 0) },
      cartao: { ...daForma("cartao"), ativos: Number(ativosPorForma[0]?.cartao ?? 0) },
    },
  };
}

/** Cancela no Mercado Pago as assinaturas que ainda cobrariam o aluno (usado ao excluir a conta). */
export async function cancelarAssinaturasDoUsuario(usuarioId: string) {
  const lista = await db.select().from(assinaturas).where(eq(assinaturas.usuarioId, usuarioId));
  for (const a of lista) {
    if (a.status === "authorized" || a.status === "pending" || a.status === "paused") await cancelarAssinatura(a.id);
  }
}
