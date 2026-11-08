"use server";

// Ações da assinatura do aluno. Começam com exigirUsuario(); o aluno só mexe na própria assinatura.
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
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
  sincronizarPixPorId,
  type DadosPix,
} from "./assinatura";
import { assinarComCartaoEfi, CartaoRecusadoEfi } from "./assinatura-efi";
import { efiCartaoAtivo, ErroEfi, textoDoErroEfi } from "./efi";
import { cepValido, cpfValido, soDigitos, telefoneValido, UFS } from "@/lib/documentos";

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
  // Antifraude do próprio Mercado Pago (cc_rejected_high_risk), não o banco (confirmado pelo suporte em 07/11).
  // Eles orientam: nome e CPF exatamente como no cartão e não repetir várias tentativas seguidas.
  if (texto.includes("high_risk")) {
    return "O pagamento foi recusado pela análise de segurança do Mercado Pago. Confira se o nome e o CPF são exatamente os do titular do cartão e tente mais tarde (tentar várias vezes seguidas piora), ou assine pelo Pix, que libera na hora.";
  }
  if (texto.includes("insufficient") || texto.includes("saldo")) return "O cartão não tem limite suficiente.";
  if (texto.includes("security_code") || texto.includes("cvv")) return "O código de segurança (CVV) não confere.";
  if (texto.includes("expir")) return "O cartão está vencido ou a data de validade está errada.";
  if (texto.includes("payer_email") || texto.includes("email")) return "Confira o e-mail informado no pagamento.";
  return "O pagamento foi recusado. Confira os dados do cartão (nome e CPF do titular, exatamente como no cartão) ou assine pelo Pix, que libera na hora.";
}

/** Celular ou computador e navegador (app ou não), para o log das recusas. */
async function aparelho() {
  const ua = (await headers()).get("user-agent") ?? "";
  const tipo = /Mobi|Android|iPhone|iPad/i.test(ua) ? "celular" : "computador";
  const app = ua.match(/Instagram|FBAN|FBAV|FB_IAB|WhatsApp|TikTok|BytedanceWebview|Line\/|Snapchat|Twitter/i)?.[0];
  const navegador = app ? `app ${app}` : (ua.match(/Edg|OPR|SamsungBrowser|Firefox|CriOS|Chrome|Safari/)?.[0] ?? "outro");
  return `${tipo}, ${navegador}`;
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
    // Sempre o e-mail da conta: o Mercado Pago pede o mesmo payer_email em todas as tentativas do comprador.
    const status = await assinarComCartao(usuario, { ...dados.data, email: usuario.email }, dados.data.plano);
    revalidatePath("/assinatura");
    return { ok: true, ativa: status === "authorized" };
  } catch (erro) {
    const detalhe = await motivoDaRecusa(usuario.id).catch(() => null);
    // Código do aparelho junto ou não: o Mercado Pago pergunta isso ao investigar recusas por risco.
    console.error(
      `[assinatura] cartão recusado ou falha (${detalhe ?? "sem motivo"}; código do aparelho: ${dados.data.dispositivo ? "enviado" : "ausente"}; ${await aparelho()}):`,
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

// ---------- Cartão na Efí ----------

const texto = (max: number) => z.string().trim().min(1).max(max);

const cartaoEfiSchema = z.object({
  /** payment_token gerado no navegador pelo payment-token-efi (o número do cartão nunca chega aqui). */
  token: z.string().min(8).max(500),
  plano: planoSchema,
  nome: texto(100).refine((n) => n.split(/\s+/).length >= 2, "Nome e sobrenome"),
  cpf: z.string().refine(cpfValido, "CPF inválido").transform(soDigitos),
  nascimento: z.iso.date(),
  celular: z.string().refine(telefoneValido, "Celular inválido").transform(soDigitos),
  cep: z.string().refine(cepValido, "CEP inválido").transform(soDigitos),
  rua: texto(200),
  numero: texto(55),
  bairro: texto(100),
  cidade: texto(100),
  uf: z.enum(UFS),
  complemento: z.string().trim().max(55).optional(),
  /** O script de antifraude da Efí foi bloqueado no navegador (só para o log). */
  antifraudeBloqueado: z.boolean().optional(),
});

/** Mensagem da Efí para o aluno (em português simples). */
function motivoRecusaEfi(erro: unknown) {
  if (erro instanceof CartaoRecusadoEfi) {
    return "O banco recusou o pagamento. Confira os dados do cartão, veja se ele tem limite e se compras online estão liberadas no app do banco, ou assine pelo Pix, que libera na hora.";
  }
  const t = textoDoErroEfi(erro).toLowerCase();
  if (t.includes("birth") || t.includes("nascimento")) return "Confira a data de nascimento.";
  if (t.includes("cpf")) return "Confira o CPF do titular do cartão.";
  if (t.includes("phone")) return "Confira o celular com DDD.";
  if (t.includes("zipcode") || t.includes("cep") || t.includes("billing_address")) return "Confira o endereço de cobrança.";
  if (t.includes("payment_token") || t.includes("token")) return "Os dados do cartão expiraram. Confira e tente de novo.";
  return "Não foi possível concluir o pagamento. Confira os dados ou assine pelo Pix, que libera na hora.";
}

/**
 * Falha no navegador antes de chegar à Efí (o cartão não virou token). Só registra no log da Vercel, com o
 * navegador e se o antifraude foi bloqueado: sem isso essas tentativas não deixavam rastro.
 */
export async function registrarFalhaCartao(entrada: unknown) {
  const usuario = await exigirUsuario();
  const d = z
    .object({ etapa: z.enum(["token", "formulario"]), bloqueado: z.boolean(), detalhe: z.string().max(300) })
    .safeParse(entrada);
  if (!d.success) return;
  console.error(
    `[efi] cartão não virou token (${d.data.etapa}; antifraude ${d.data.bloqueado ? "BLOQUEADO" : "ok"}; ${await aparelho()}; usuário ${usuario.id}): ${d.data.detalhe}`,
  );
}

/** Assinatura mensal no cartão pela Efí. Recebe só o token do cartão e os dados do titular. */
export async function assinarCartaoEfi(entrada: unknown): Promise<ResultadoCartao> {
  const usuario = await exigirUsuario();
  if (!CARTAO_LIGADO || !efiCartaoAtivo()) return { ok: false, erro: CARTAO_INDISPONIVEL };
  const dados = cartaoEfiSchema.safeParse(entrada);
  if (!dados.success) {
    const primeiro = dados.error.issues[0];
    return { ok: false, erro: primeiro?.message && !primeiro.message.startsWith("Invalid") ? primeiro.message : "Confira os dados do formulário." };
  }
  if (await mensalAtiva(usuario.id)) return { ok: false, erro: "Sua assinatura já está ativa." };
  const d = dados.data;
  try {
    const status = await assinarComCartaoEfi(
      usuario.id,
      {
        token: d.token,
        cliente: { name: d.nome, cpf: d.cpf, email: usuario.email, phone_number: d.celular, birth: d.nascimento },
        endereco: { street: d.rua, number: d.numero, neighborhood: d.bairro, zipcode: d.cep, city: d.cidade, state: d.uf, complement: d.complemento },
      },
      d.plano,
    );
    revalidatePath("/assinatura");
    return { ok: true, ativa: status === "authorized" };
  } catch (erro) {
    console.error(
      `[efi] cartão recusado ou falha (${erro instanceof ErroEfi ? textoDoErroEfi(erro) : erro instanceof CartaoRecusadoEfi ? "1ª cobrança recusada" : "erro"}; antifraude ${d.antifraudeBloqueado ? "BLOQUEADO" : "ok"}; ${await aparelho()}):`,
      erro,
    );
    revalidatePath("/assinatura");
    return { ok: false, erro: motivoRecusaEfi(erro) };
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
  // "pix:<id do Mercado Pago>" ou "pix:efi:<txid>".
  const id = z.string().regex(/^pix:(\d{1,20}|efi:[a-zA-Z0-9]{26,35})$/).safeParse(entrada);
  if (!id.success) return { pago: false, status: "invalido" };
  const [a] = await db
    .select({ id: assinaturas.id })
    .from(assinaturas)
    .where(and(eq(assinaturas.id, id.data), eq(assinaturas.usuarioId, usuario.id)))
    .limit(1);
  if (!a || !ehPix(a.id)) return { pago: false, status: "invalido" };
  try {
    const status = await sincronizarPixPorId(a.id);
    if (status === "approved") revalidatePath("/assinatura");
    return { pago: status === "approved", status };
  } catch (erro) {
    console.error("[pix] falha ao conferir:", erro);
    return { pago: false, status: "pending" };
  }
}
