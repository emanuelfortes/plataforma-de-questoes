import "server-only";
import { Agent, request } from "node:https";

// Cliente das APIs da Efí (Pix e Cobranças). Só servidor.
//
// - API Pix: exige o certificado (.p12) em toda chamada (mTLS), inclusive na do token.
// - API Cobranças (cartão recorrente): o certificado vai junto se existir; o servidor só usa se pedir.
//
// Variáveis (veja docs/EFI.md):
//   EFI_CLIENT_ID, EFI_CLIENT_SECRET   credenciais da aplicação (produção ou homologação)
//   EFI_CERTIFICADO                    o .p12 da Efí em base64 (uma linha)
//   EFI_CHAVE_PIX                      chave Pix que recebe (chave aleatória da conta Efí)
//   EFI_SANDBOX                        "true" para homologação
//   EFI_WEBHOOK_SEGREDO                texto aleatório que vai na URL dos avisos
//   NEXT_PUBLIC_EFI_CONTA              identificador de conta (formulário do cartão, no navegador)

const sandbox = () => process.env.EFI_SANDBOX === "true";

const BASES = {
  pix: () => (sandbox() ? "https://pix-h.api.efipay.com.br" : "https://pix.api.efipay.com.br"),
  cobrancas: () => (sandbox() ? "https://cobrancas-h.api.efipay.com.br" : "https://cobrancas.api.efipay.com.br"),
};

type Api = keyof typeof BASES;

/** Pix na Efí configurado (credenciais, certificado e chave). Novos Pix passam a sair pela Efí. */
export function efiPixAtivo() {
  return !!(process.env.EFI_CLIENT_ID && process.env.EFI_CLIENT_SECRET && process.env.EFI_CERTIFICADO && process.env.EFI_CHAVE_PIX);
}

/** Cartão na Efí configurado (credenciais e o identificador de conta usado no navegador). */
export function efiCartaoAtivo() {
  return !!(process.env.EFI_CLIENT_ID && process.env.EFI_CLIENT_SECRET && process.env.NEXT_PUBLIC_EFI_CONTA);
}

export const ambienteEfi = () => (sandbox() ? "sandbox" : "production");

let agente: Agent | null = null;
function agenteTls() {
  if (agente) return agente;
  const cert = process.env.EFI_CERTIFICADO;
  // O .p12 da Efí vem sem senha.
  agente = new Agent({ keepAlive: true, ...(cert ? { pfx: Buffer.from(cert, "base64"), passphrase: "" } : {}) });
  return agente;
}

export class ErroEfi extends Error {
  constructor(
    readonly status: number,
    readonly corpo: unknown,
    caminho: string,
  ) {
    super(`Efí ${status} em ${caminho}: ${JSON.stringify(corpo).slice(0, 500)}`);
  }
}

function chamar(api: Api, metodo: string, caminho: string, opcoes: { corpo?: unknown; autorizacao: string; cabecalhos?: Record<string, string> }) {
  const url = new URL(caminho, BASES[api]());
  const corpo = opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo);
  return new Promise<unknown>((resolver, rejeitar) => {
    const req = request(
      url,
      {
        method: metodo,
        agent: agenteTls(),
        timeout: 15_000,
        headers: {
          authorization: opcoes.autorizacao,
          accept: "application/json",
          ...(corpo ? { "content-type": "application/json", "content-length": Buffer.byteLength(corpo) } : {}),
          ...opcoes.cabecalhos,
        },
      },
      (res) => {
        const partes: Buffer[] = [];
        res.on("data", (p: Buffer) => partes.push(p));
        res.on("end", () => {
          const texto = Buffer.concat(partes).toString("utf8");
          let json: unknown = texto;
          try {
            json = texto ? JSON.parse(texto) : null;
          } catch {
            // resposta sem JSON (ex.: 204)
          }
          const status = res.statusCode ?? 0;
          if (status >= 200 && status < 300) resolver(json);
          else rejeitar(new ErroEfi(status, json, `${metodo} ${caminho}`));
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error(`Efí: tempo esgotado em ${metodo} ${caminho}`)));
    req.on("error", rejeitar);
    if (corpo) req.write(corpo);
    req.end();
  });
}

// Token de acesso (vale 1 hora): guardado na memória da função enquanto ela estiver quente.
const tokens: Partial<Record<Api, { valor: string; expira: number }>> = {};

async function token(api: Api) {
  const t = tokens[api];
  if (t && t.expira > Date.now() + 60_000) return t.valor;
  const id = process.env.EFI_CLIENT_ID;
  const segredo = process.env.EFI_CLIENT_SECRET;
  if (!id || !segredo) throw new Error("EFI_CLIENT_ID e EFI_CLIENT_SECRET não configurados.");
  const basic = `Basic ${Buffer.from(`${id}:${segredo}`).toString("base64")}`;
  const caminho = api === "pix" ? "/oauth/token" : "/v1/authorize";
  const r = (await chamar(api, "POST", caminho, { corpo: { grant_type: "client_credentials" }, autorizacao: basic })) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!r?.access_token) throw new Error("A Efí não devolveu o token de acesso.");
  tokens[api] = { valor: r.access_token, expira: Date.now() + (r.expires_in ?? 3600) * 1000 };
  return r.access_token;
}

async function efi<T>(api: Api, metodo: string, caminho: string, corpo?: unknown, cabecalhos?: Record<string, string>) {
  return (await chamar(api, metodo, caminho, { corpo, autorizacao: `Bearer ${await token(api)}`, cabecalhos })) as T;
}

// ---------- API Pix ----------

export type CobPix = {
  txid: string;
  status: "ATIVA" | "CONCLUIDA" | "REMOVIDA_PELO_USUARIO_RECEBEDOR" | "REMOVIDA_PELO_PSP";
  calendario: { criacao: string; expiracao: number };
  valor: { original: string };
  loc?: { id: number };
  pixCopiaECola?: string;
  pix?: { endToEndId: string; valor: string; horario: string; devolucoes?: { valor: string; status: string }[] }[];
};

/** Cria a cobrança imediata com o nosso txid (26 a 35 letras e números). */
export function criarCobPix(txid: string, corpo: { expiracao: number; valor: number; descricao: string }) {
  return efi<CobPix>("pix", "PUT", `/v2/cob/${txid}`, {
    calendario: { expiracao: corpo.expiracao },
    valor: { original: corpo.valor.toFixed(2) },
    chave: process.env.EFI_CHAVE_PIX,
    solicitacaoPagador: corpo.descricao.slice(0, 140),
  });
}

export const consultarCobPix = (txid: string) => efi<CobPix>("pix", "GET", `/v2/cob/${txid}`);

/** QR code da cobrança: imagem (data URI) e o copia e cola. */
export const qrCodePix = (locId: number) => efi<{ qrcode: string; imagemQrcode: string }>("pix", "GET", `/v2/loc/${locId}/qrcode`);

/**
 * Cadastra a URL dos avisos de Pix da chave. A Vercel não faz TLS mútuo, então vai o "x-skip-mtls-checking" e a
 * segurança fica por conta do segredo na URL (e de sempre buscar a cobrança na API antes de gravar).
 */
export const cadastrarWebhookPix = (url: string) =>
  efi<unknown>("pix", "PUT", `/v2/webhook/${encodeURIComponent(process.env.EFI_CHAVE_PIX ?? "")}`, { webhookUrl: url }, { "x-skip-mtls-checking": "true" });

export const consultarWebhookPix = () => efi<unknown>("pix", "GET", `/v2/webhook/${encodeURIComponent(process.env.EFI_CHAVE_PIX ?? "")}`);

// ---------- API Cobranças (cartão recorrente) ----------

type RespostaCobrancas<T> = { code: number; data: T };

export type AssinaturaEfi = {
  subscription_id: number;
  value: number;
  status: "new" | "active" | "new_charge" | "canceled" | "expired";
  custom_id?: string | null;
  next_execution?: string | null;
  created_at?: string;
  history?: { charge_id: number; status: string; created_at: string }[];
};

export type CobrancaEfi = {
  charge_id: number;
  total: number;
  status: string;
  custom_id?: string | null;
  created_at?: string;
  subscription?: { subscription_id: number } | null;
  payment?: { credit_card?: { reason?: string } | null } | null;
};

export type ClienteEfi = {
  name: string;
  cpf: string;
  email: string;
  phone_number: string;
  birth: string;
};

export type EnderecoEfi = {
  street: string;
  number: string;
  neighborhood: string;
  zipcode: string;
  city: string;
  state: string;
  complement?: string;
};

const NOME_PLANO = "QProva mensal";
let planoId: number | null = null;

/**
 * Plano mensal sem fim na Efí (o valor vai em cada assinatura, então um plano serve para Basic, Elite e promoção).
 * Procura pelo nome e cria se não existir.
 */
async function planoMensal() {
  if (planoId) return planoId;
  const lista = await efi<RespostaCobrancas<{ plan_id: number; name: string; interval: number; repeats: number | null }[]>>(
    "cobrancas",
    "GET",
    `/v1/plans?name=${encodeURIComponent(NOME_PLANO)}`,
  );
  const existente = lista.data?.find((p) => p.name === NOME_PLANO && p.interval === 1 && p.repeats === null);
  if (existente) return (planoId = existente.plan_id);
  const novo = await efi<RespostaCobrancas<{ plan_id: number }>>("cobrancas", "POST", "/v1/plan", { name: NOME_PLANO, interval: 1, repeats: null });
  return (planoId = novo.data.plan_id);
}

export async function criarAssinaturaCartao(dados: {
  nomeItem: string;
  centavos: number;
  referencia: string;
  urlAviso?: string;
  token: string;
  cliente: ClienteEfi;
  endereco: EnderecoEfi;
  diasGratis?: number;
}) {
  const plano = await planoMensal();
  const r = await efi<RespostaCobrancas<{ subscription_id: number; status: string; charge?: { id: number; status: string } }>>(
    "cobrancas",
    "POST",
    `/v1/plan/${plano}/subscription/one-step`,
    {
      items: [{ name: dados.nomeItem, value: dados.centavos, amount: 1 }],
      metadata: { custom_id: dados.referencia, ...(dados.urlAviso ? { notification_url: dados.urlAviso } : {}) },
      payment: {
        credit_card: {
          customer: dados.cliente,
          payment_token: dados.token,
          billing_address: { ...dados.endereco, complement: dados.endereco.complement || undefined },
          ...(dados.diasGratis ? { trial_days: dados.diasGratis } : {}),
        },
      },
    },
  );
  return r.data;
}

export const consultarAssinaturaEfi = async (id: string) =>
  (await efi<RespostaCobrancas<AssinaturaEfi>>("cobrancas", "GET", `/v1/subscription/${id}`)).data;

export const consultarCobrancaEfi = async (id: string | number) =>
  (await efi<RespostaCobrancas<CobrancaEfi>>("cobrancas", "GET", `/v1/charge/${id}`)).data;

export const cancelarAssinaturaEfi = (id: string) => efi<unknown>("cobrancas", "PUT", `/v1/subscription/${id}/cancel`);

/** Muda o valor das próximas cobranças (troca de plano). */
export const mudarValorAssinaturaEfi = (id: string, nomeItem: string, centavos: number) =>
  efi<unknown>("cobrancas", "PUT", `/v1/subscription/${id}`, { items: [{ name: nomeItem, value: centavos, amount: 1 }] });

export type MudancaEfi = {
  id: number;
  type: string;
  custom_id?: string | null;
  status?: { current: string; previous: string | null };
  identifiers?: { subscription_id?: number; charge_id?: number };
};

/** O aviso da Efí traz só um token; as mudanças são buscadas aqui (com o nosso acesso). */
export const consultarNotificacaoEfi = async (token: string) =>
  (await efi<RespostaCobrancas<MudancaEfi[]>>("cobrancas", "GET", `/v1/notification/${encodeURIComponent(token)}`)).data ?? [];

/** Mensagem de erro da API de Cobranças (para log e para entender a recusa). */
export function textoDoErroEfi(erro: unknown) {
  if (!(erro instanceof ErroEfi)) return String(erro);
  const c = erro.corpo as { error_description?: unknown; mensagem?: string } | null;
  const d = c?.error_description;
  return typeof d === "string" ? d : d ? JSON.stringify(d) : (c?.mensagem ?? erro.message);
}
