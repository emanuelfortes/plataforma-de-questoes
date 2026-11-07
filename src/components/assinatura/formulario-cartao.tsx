"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Plano } from "@/lib/planos";
import { assinarCartao } from "@/server/acoes-assinatura";

// Checkout transparente: o formulário de cartão do Mercado Pago (Card Payment Brick) aparece dentro
// da nossa página. Ele valida o cartão e devolve só um token; o número nunca passa pelo nosso servidor.
// Só carrega o script do Mercado Pago quando o aluno clica em assinar. O de segurança (código do aparelho, para o
// antifraude) carrega ao abrir a tela: ele leva alguns segundos para identificar o aparelho.

const SDK = "https://sdk.mercadopago.com/js/v2";
const SEGURANCA = "https://www.mercadopago.com/v2/security.js";
const ID_CAIXA = "formulario-cartao-mp"; // + "-<plano>": cada plano tem a sua caixa na mesma página

type DadosBrick = { token: string; payer?: { email?: string } };
type ControleBrick = { unmount: () => void };
type MercadoPagoSDK = new (
  chave: string,
  opcoes: { locale: string },
) => { bricks: () => { create: (tipo: string, id: string, config: unknown) => Promise<ControleBrick> } };

declare global {
  interface Window {
    MercadoPago?: MercadoPagoSDK;
    /** Preenchido pelo security.js do Mercado Pago. */
    MP_DEVICE_SESSION_ID?: string;
  }
}

function carregarSeguranca() {
  if (document.querySelector(`script[src="${SEGURANCA}"]`)) return;
  const script = Object.assign(document.createElement("script"), { src: SEGURANCA, async: true });
  script.setAttribute("view", "checkout");
  document.head.appendChild(script);
}

/**
 * Espera o security.js preencher o código do aparelho (leva alguns segundos depois de abrir a tela). Sem ele o
 * antifraude dá nota de risco mais alta; quem preenche o cartão rápido mandava o pagamento antes do código ficar pronto.
 */
async function esperarDispositivo(limiteMs = 10_000) {
  const fim = Date.now() + limiteMs;
  while (!window.MP_DEVICE_SESSION_ID && Date.now() < fim) await new Promise((r) => setTimeout(r, 250));
  return window.MP_DEVICE_SESSION_ID || undefined;
}

/**
 * Navegador interno de app (Instagram, Facebook, WhatsApp, TikTok...): o link aberto dentro do app. Nele o security.js
 * costuma não identificar o aparelho e o antifraude recusa o cartão; no Chrome ou no Safari passa.
 */
function navegadorDeApp() {
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|WhatsApp|TikTok|musical_ly|BytedanceWebview|Line\/|Snapchat|Twitter/i.test(navigator.userAgent);
}

function carregarSdk() {
  if (window.MercadoPago) return Promise.resolve();
  return new Promise<void>((resolver, rejeitar) => {
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${SDK}"]`);
    const script = existente ?? Object.assign(document.createElement("script"), { src: SDK, async: true });
    script.addEventListener("load", () => resolver());
    script.addEventListener("error", () => rejeitar(new Error("sdk")));
    if (!existente) document.head.appendChild(script);
  });
}

function temaEscuro() {
  const escolhido = document.documentElement.dataset.tema;
  if (escolhido) return escolhido === "escuro";
  return !window.matchMedia("(prefers-color-scheme: light)").matches;
}

export function FormularioCartao({
  chavePublica,
  email,
  rotulo,
  plano = "basico",
  valor,
}: {
  chavePublica: string;
  email: string;
  rotulo: string;
  plano?: Plano;
  /** Preço de hoje, calculado no servidor (precoDoPlano). O valor cobrado é decidido no servidor. */
  valor: number;
}) {
  const idCaixa = `${ID_CAIXA}-${plano}`;
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<null | "ativa" | "aguardando">(null);
  // Só depois de montar (no servidor não há navigator).
  const [dentroDeApp, setDentroDeApp] = useState(false);
  const controle = useRef<ControleBrick | null>(null);

  useEffect(carregarSeguranca, []);
  useEffect(() => setDentroDeApp(navegadorDeApp()), []);

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setPronto(false);
    carregarSdk()
      .then(async () => {
        if (cancelado || !window.MercadoPago) return;
        const mp = new window.MercadoPago(chavePublica, { locale: "pt-BR" });
        const c = await mp.bricks().create("cardPayment", idCaixa, {
          initialization: { amount: valor, payer: { email } },
          customization: {
            paymentMethods: { maxInstallments: 1, types: { excluded: ["debit_card", "prepaid_card"] } },
            visual: { style: { theme: temaEscuro() ? "dark" : "default" }, texts: { formTitle: "Cartão de crédito", formSubmit: "Assinar" } },
          },
          callbacks: {
            onReady: () => setPronto(true),
            onError: (e: unknown) => console.error("[assinatura] formulário do cartão:", e),
            onSubmit: async (dados: DadosBrick) => {
              setErro(null);
              const r = await assinarCartao({
                token: dados.token,
                email: dados.payer?.email || email,
                plano,
                dispositivo: await esperarDispositivo(),
              });
              if (!r.ok) {
                setErro(r.erro);
                // Recusa do antifraude pausa o cartão: a tela troca o formulário pelo aviso e o Pix.
                router.refresh();
                // Token de cartão vale uma vez: rejeitar faz o formulário liberar nova tentativa.
                throw new Error(r.erro);
              }
              setSucesso(r.ativa ? "ativa" : "aguardando");
              router.refresh();
            },
          },
        });
        if (cancelado) c.unmount();
        else controle.current = c;
      })
      .catch(() => setErro("Não foi possível abrir o pagamento. Confira sua internet e tente de novo."));
    return () => {
      cancelado = true;
      controle.current?.unmount();
      controle.current = null;
    };
  }, [aberto, chavePublica, email, router, idCaixa, plano, valor]);

  if (sucesso) {
    return (
      <p className="rounded-xl border border-acerto/40 bg-acerto-suave p-4 text-sm font-bold text-acerto">
        {sucesso === "ativa"
          ? "Pagamento aprovado. Sua assinatura está ativa!"
          : "Recebemos o seu cartão. A confirmação do Mercado Pago costuma levar poucos minutos."}
      </p>
    );
  }

  const avisoApp = dentroDeApp && (
    <p className="rounded-xl border border-destaque/40 bg-destaque-suave p-3 text-sm leading-relaxed">
      <strong className="text-destaque">Você abriu o site dentro de um app.</strong> Para pagar no cartão, abra no Chrome ou no
      Safari (toque nos três pontinhos e em &quot;Abrir no navegador&quot;): aqui o banco costuma recusar. Ou pague com Pix logo
      abaixo, que libera na hora.
    </p>
  );

  if (!aberto) {
    return (
      <div className="space-y-3">
        {avisoApp}
        <Button tamanho="grande" className="w-full shadow-lg shadow-marca/30 sm:w-auto sm:px-10" onClick={() => setAberto(true)}>
          {rotulo}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!pronto && !erro && <p className="text-sm text-suave">Abrindo o pagamento seguro...</p>}
      <div id={idCaixa} />
      {erro && <p className="text-sm font-bold text-erro">{erro}</p>}
    </div>
  );
}
