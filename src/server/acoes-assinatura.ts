"use server";

// Ações da assinatura do aluno. Começam com exigirUsuario(); o aluno só mexe na própria assinatura.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirUsuario } from "@/lib/sessao";
import type { Plano } from "@/lib/planos";
import {
  assinarComCartao,
  assinaturaDoUsuario,
  cancelarAssinatura,
  criarCheckout,
  mudarPlano,
} from "./assinatura";

const planoSchema = z.enum(["basico", "elite"]);

export type ResultadoAssinar = { ok: true; url: string } | { ok: false; erro: string };

/** Mensal já ativa? (quem cancelou e ainda tem período pago pode assinar: a cobrança começa no fim do acesso). */
const mensalAtiva = async (usuarioId: string) => (await assinaturaDoUsuario(usuarioId))?.status === "authorized";

/** Cria a assinatura no Mercado Pago e devolve o link do checkout. */
export async function assinar(entrada: unknown = "basico"): Promise<ResultadoAssinar> {
  const usuario = await exigirUsuario();
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
});

// Mensagens do Mercado Pago para cartão recusado (cause[].code ou message) em português simples.
function motivoRecusa(erro: unknown) {
  const texto = JSON.stringify(erro ?? "").toLowerCase();
  if (texto.includes("insufficient") || texto.includes("saldo")) return "O cartão não tem limite suficiente.";
  if (texto.includes("security_code") || texto.includes("cvv")) return "O código de segurança (CVV) não confere.";
  if (texto.includes("expir")) return "O cartão está vencido ou a data de validade está errada.";
  if (texto.includes("payer_email") || texto.includes("email")) return "Confira o e-mail informado no pagamento.";
  return "O pagamento foi recusado. Confira os dados do cartão ou tente outro cartão.";
}

export type ResultadoCartao = { ok: true; ativa: boolean } | { ok: false; erro: string };

/** Checkout transparente: recebe só o token do cartão (gerado pelo formulário do Mercado Pago). */
export async function assinarCartao(entrada: unknown): Promise<ResultadoCartao> {
  const usuario = await exigirUsuario();
  const dados = cartaoSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Dados do cartão incompletos." };
  if (await mensalAtiva(usuario.id)) {
    return { ok: false, erro: "Sua assinatura já está ativa." };
  }
  try {
    const status = await assinarComCartao(usuario, dados.data, dados.data.plano);
    revalidatePath("/assinatura");
    return { ok: true, ativa: status === "authorized" };
  } catch (erro) {
    console.error("[assinatura] cartão recusado ou falha:", erro);
    return { ok: false, erro: motivoRecusa(erro) };
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
    await mudarPlano(a.id, plano.data satisfies Plano);
  } catch (erro) {
    console.error("[assinatura] falha ao trocar de plano:", erro);
    return { ok: false, erro: "Não foi possível trocar de plano agora. Tente de novo em alguns minutos." };
  }
  revalidatePath("/assinatura");
  return { ok: true };
}
