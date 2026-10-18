"use server";

// Ações da assinatura do aluno. Começam com exigirUsuario(); o aluno só mexe na própria assinatura.
import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/sessao";
import { acessoLiberado, assinaturaDoUsuario, cancelarAssinatura, criarCheckout } from "./assinatura";

export type ResultadoAssinar = { ok: true; url: string } | { ok: false; erro: string };

/** Cria a assinatura no Mercado Pago e devolve o link do checkout. */
export async function assinar(): Promise<ResultadoAssinar> {
  const usuario = await exigirUsuario();
  if (acessoLiberado(await assinaturaDoUsuario(usuario.id))) {
    return { ok: false, erro: "Sua assinatura já está ativa." };
  }
  try {
    return { ok: true, url: await criarCheckout(usuario) };
  } catch (erro) {
    console.error("[assinatura] falha ao criar checkout:", erro);
    return { ok: false, erro: "Não foi possível abrir o pagamento agora. Tente de novo em alguns minutos." };
  }
}

export async function cancelar(): Promise<{ ok: boolean; erro?: string }> {
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
