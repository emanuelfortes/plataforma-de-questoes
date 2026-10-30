"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ASSINATURA } from "@/lib/planos";
import { assinarCartao } from "@/server/acoes-assinatura";

// Checkout transparente: o formulário de cartão do Mercado Pago (Card Payment Brick) aparece dentro
// da nossa página. Ele valida o cartão e devolve só um token; o número nunca passa pelo nosso servidor.
// Só carrega o script do Mercado Pago quando o aluno clica em assinar.

const SDK = "https://sdk.mercadopago.com/js/v2";
const ID_CAIXA = "formulario-cartao-mp";

type DadosBrick = { token: string; payer?: { email?: string } };
type ControleBrick = { unmount: () => void };
type MercadoPagoSDK = new (
  chave: string,
  opcoes: { locale: string },
) => { bricks: () => { create: (tipo: string, id: string, config: unknown) => Promise<ControleBrick> } };

declare global {
  interface Window {
    MercadoPago?: MercadoPagoSDK;
  }
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

export function FormularioCartao({ chavePublica, email, rotulo }: { chavePublica: string; email: string; rotulo: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<null | "ativa" | "aguardando">(null);
  const controle = useRef<ControleBrick | null>(null);

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setPronto(false);
    carregarSdk()
      .then(async () => {
        if (cancelado || !window.MercadoPago) return;
        const mp = new window.MercadoPago(chavePublica, { locale: "pt-BR" });
        const c = await mp.bricks().create("cardPayment", ID_CAIXA, {
          initialization: { amount: ASSINATURA.valor, payer: { email } },
          customization: {
            paymentMethods: { maxInstallments: 1, types: { excluded: ["debit_card", "prepaid_card"] } },
            visual: { style: { theme: temaEscuro() ? "dark" : "default" }, texts: { formSubmit: "Assinar" } },
          },
          callbacks: {
            onReady: () => setPronto(true),
            onError: (e: unknown) => console.error("[assinatura] formulário do cartão:", e),
            onSubmit: async (dados: DadosBrick) => {
              setErro(null);
              const r = await assinarCartao({ token: dados.token, email: dados.payer?.email || email });
              if (!r.ok) {
                setErro(r.erro);
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
  }, [aberto, chavePublica, email, router]);

  if (sucesso) {
    return (
      <p className="rounded-xl border border-acerto/40 bg-acerto-suave p-4 text-sm font-bold text-acerto">
        {sucesso === "ativa"
          ? "Pagamento aprovado. Sua assinatura está ativa!"
          : "Recebemos o seu cartão. A confirmação do Mercado Pago costuma levar poucos minutos."}
      </p>
    );
  }

  if (!aberto) {
    return (
      <Button tamanho="grande" className="w-full shadow-lg shadow-marca/30 sm:w-auto sm:px-10" onClick={() => setAberto(true)}>
        {rotulo}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {!pronto && !erro && <p className="text-sm text-suave">Abrindo o pagamento seguro...</p>}
      <div id={ID_CAIXA} />
      {erro && <p className="text-sm font-bold text-erro">{erro}</p>}
    </div>
  );
}
