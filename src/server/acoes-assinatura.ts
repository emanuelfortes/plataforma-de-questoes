"use server";

// Ações da assinatura do aluno. Começam com exigirUsuario(); o aluno só mexe na própria assinatura.
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { assinaturas } from "@/db/schema";
import { exigirUsuario } from "@/lib/sessao";
import { CARTAO_LIGADO, type Plano } from "@/lib/planos";
import {
  assinarComCartao,
  assinaturaDoUsuario,
  cancelarAssinatura,
  COOKIE_PAUSA_CARTAO,
  criarCheckout,
  ehPix,
  gerarPix,
  motivoDaRecusa,
  mudarPlano,
  PAUSA_CARTAO_MINUTOS,
  pausaDoCartao,
  sincronizarPix,
  type DadosPix,
} from "./assinatura";

const planoSchema = z.enum(["basico", "elite"]);

export type ResultadoAssinar = { ok: true; url: string } | { ok: false; erro: string };

/** Mensal já ativa? (quem cancelou e ainda tem período pago pode assinar: a cobrança começa no fim do acesso). */
const mensalAtiva = async (usuarioId: string) => (await assinaturaDoUsuario(usuarioId))?.status === "authorized";

/** Cria a assinatura no Mercado Pago e devolve o link do checkout. */
const CARTAO_INDISPONIVEL = "O cartão está indisponível no momento. Pague com Pix, que libera na hora.";

export async function assinar(entrada: unknown = "basico"): Promise<ResultadoAssinar> {
  const usuario = await exigirUsuario();
  if (!CARTAO_LIGADO) return { ok: false, erro: CARTAO_INDISPONIVEL };
  const plano = planoSchema.safeParse(entrada);
  if (!plano.success) return { ok: false, erro: "Plano inválido." };
  if (await mensalAtiva(usuario.id)) {
    return { ok: false, erro: "Sua assinatura já está ativa." };
  }
  try {
    return { ok: true, url: await criarCheckout(usuario, plano.data) };
  } catch (erro) {
    console.error("[assinatura] falha ao criar checkout:", erro);
    return { ok: false, erro: "Não foi possível abrir o pagamento agora. Tente de novo em alguns minutos." };
  }
}

const cartaoSchema = z.object({
  token: z.string().min(8).max(200),
  email: z.email().max(200),
  plano: planoSchema.default("basico"),
  /**
   * Código do aparelho gerado pelo security.js do Mercado Pago (ex.: "armor.1f2c...", com ponto). Pode faltar se
   * o script não carregou; se vier num formato inesperado, é ignorado em vez de barrar o pagamento.
   */
  dispositivo: z.string().regex(/^[\w.:-]{8,300}$/).optional().catch(undefined),
});

// Mensagens do Mercado Pago para cartão recusado (cause[].code ou message) em português simples.
function motivoRecusa(erro: unknown, detalhe: string | null) {
  const texto = `${JSON.stringify(erro ?? "")} ${detalhe ?? ""}`.toLowerCase();
  // Antifraude do Mercado Pago (cc_rejected_high_risk): outro cartão costuma cair no mesmo; o Pix passa.
  // O Mercado Pago orienta: muitos bancos bloqueiam cobrança recorrente até o cliente liberar no app do banco.
  if (texto.includes("high_risk")) {
    return "O pagamento foi recusado por segurança. Seu banco pode estar bloqueando assinaturas: libere compras recorrentes (ou online) no app do banco e tente de novo, ou assine pelo Pix, que libera na hora.";
  }
  if (texto.includes("insufficient") || texto.includes("saldo")) return "O cartão não tem limite suficiente.";
  if (texto.includes("security_code") || texto.includes("cvv")) return "O código de segurança (CVV) não confere.";
  if (texto.includes("expir")) return "O cartão está vencido ou a data de validade está errada.";
  if (texto.includes("payer_email") || texto.includes("email")) return "Confira o e-mail informado no pagamento.";
  return "O pagamento foi recusado. Confira os dados do cartão, libere compras recorrentes no app do seu banco ou assine pelo Pix.";
}

export type ResultadoCartao = { ok: true; ativa: boolean } | { ok: false; erro: string };

/** Checkout transparente: recebe só o token do cartão (gerado pelo formulário do Mercado Pago). */
export async function assinarCartao(entrada: unknown): Promise<ResultadoCartao> {
  const usuario = await exigirUsuario();
  if (!CARTAO_LIGADO) return { ok: false, erro: CARTAO_INDISPONIVEL };
  const dados = cartaoSchema.safeParse(entrada);
  if (!dados.success) {
    console.error("[assinatura] dados do cartão recusados:", dados.error.issues.map((i) => i.path.join(".")).join(", "));
    return { ok: false, erro: "Dados do cartão incompletos." };
  }
  if (await mensalAtiva(usuario.id)) {
    return { ok: false, erro: "Sua assinatura já está ativa." };
  }
  if (await pausaDoCartao()) return { ok: false, erro: "O cartão está pausado por alguns minutos. Pague com Pix, que libera na hora." };
  try {
    const status = await assinarComCartao(usuario, dados.data, dados.data.plano);
    revalidatePath("/assinatura");
    return { ok: true, ativa: status === "authorized" };
  } catch (erro) {
    const detalhe = await motivoDaRecusa(usuario.id).catch(() => null);
    // Código do aparelho junto ou não: o Mercado Pago pergunta isso ao investigar recusas por risco.
    console.error(
      `[assinatura] cartão recusado ou falha (${detalhe ?? "sem motivo"}; código do aparelho: ${dados.data.dispositivo ? "enviado" : "ausente"}):`,
      erro,
    );
    if (detalhe === "cc_rejected_high_risk") {
      const fim = Date.now() + PAUSA_CARTAO_MINUTOS * 60 * 1000;
      (await cookies()).set(COOKIE_PAUSA_CARTAO, String(fim), { httpOnly: true, sameSite: "lax", secure: true, maxAge: PAUSA_CARTAO_MINUTOS * 60, path: "/" });
      revalidatePath("/assinatura");
    }
    return { ok: false, erro: motivoRecusa(erro, detalhe) };
  }
}

export async function cancelar():Promise<{ ok: boolean; erro?: string }> {
  const usuario = await exigirUsuario();
  const a = await assinaturaDoUsuario(usuario.id);
  if (!a || a.status === "cancelled") return { ok: false, erro: "Você não tem assinatura ativa." };
  try {
    await cancelarAssinatura(a.id);
  } catch (erro) {
    console.error("[assinatura] falha ao cancelar:", erro);
    return { ok: false, erro: "Não foi possível cancelar agora. Tente de novo ou fale conosco pelo WhatsApp." };
  }
  revalidatePath("/assinatura");
  return { ok: true };
}

/** Sobe para o Elite ou volta ao Basic na assinatura mensal ativa (muda o valor das próximas cobranças). */
export async function trocarPlano(entrada: unknown): Promise<{ ok: boolean; erro?: string }> {
  const usuario = await exigirUsuario();
  const plano = planoSchema.safeParse(entrada);
  if (!plano.success) return { ok: false, erro: "Plano inválido." };
  const a = await assinaturaDoUsuario(usuario.id);
  if (!a || a.status !== "authorized") return { ok: false, erro: "Você não tem assinatura ativa." };
  try {
    await mudarPlano(a.id, a.valorCentavos, plano.data satisfies Plano);
  } catch (erro) {
    console.error("[assinatura] falha ao trocar de plano:", erro);
    return { ok: false, erro: "Não foi possível trocar de plano agora. Tente de novo em alguns minutos." };
  }
  revalidatePath("/assinatura");
  return { ok: true };
}

export type ResultadoPix = { ok: true; pix: DadosPix } | { ok: false; erro: string };

/** Gera o Pix de 30 dias do plano escolhido (o valor é decidido no servidor). */
export async function pagarComPix(entrada: unknown): Promise<ResultadoPix> {
  const usuario = await exigirUsuario();
  const plano = planoSchema.safeParse(entrada);
  if (!plano.success) return { ok: false, erro: "Plano inválido." };
  if (await mensalAtiva(usuario.id)) return { ok: false, erro: "Sua assinatura no cartão já está ativa." };
  try {
    return { ok: true, pix: await gerarPix(usuario, plano.data) };
  } catch (erro) {
    console.error("[pix] falha ao gerar:", erro);
    return { ok: false, erro: "Não foi possível gerar o Pix agora. Tente de novo em alguns minutos." };
  }
}

/** A tela pergunta de tempos em tempos se o Pix já foi pago (só o Pix do próprio aluno). */
export async function conferirPix(entrada: unknown): Promise<{ pago: boolean; status: string }> {
  const usuario = await exigirUsuario();
  const id = z.string().regex(/^\d{1,20}$/).safeParse(entrada);
  if (!id.success) return { pago: false, status: "invalido" };
  const [a] = await db
    .select({ id: assinaturas.id })
    .from(assinaturas)
    .where(and(eq(assinaturas.id, `pix:${id.data}`), eq(assinaturas.usuarioId, usuario.id)))
    .limit(1);
  if (!a || !ehPix(a.id)) return { pago: false, status: "invalido" };
  try {
    const p = await sincronizarPix(id.data);
    if (p.status === "approved") revalidatePath("/assinatura");
    return { pago: p.status === "approved", status: p.status ?? "pending" };
  } catch (erro) {
    console.error("[pix] falha ao conferir:", erro);
    return { pago: false, status: "pending" };
  }
}
