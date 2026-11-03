"use client";

import { Check, Copy, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DIAS_PIX, formatarReais, type Plano } from "@/lib/planos";
import { conferirPix, pagarComPix } from "@/server/acoes-assinatura";
import type { DadosPix } from "@/server/assinatura";

// Pix de 30 dias: gera o QR code (e o copia e cola) e fica perguntando ao servidor se já foi pago.
// O valor mostrado é só informativo: quem decide o valor cobrado é o servidor (precoDoPix).

const INTERVALO_CONFERENCIA = 4000;

export function PagamentoPix({ plano, valor, rotulo }: { plano: Plano; valor: number; rotulo?: string }) {
  const router = useRouter();
  const [pix, setPix] = useState<DadosPix | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pago, setPago] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [gerando, iniciar] = useTransition();

  useEffect(() => {
    if (!pix || pago) return;
    let parar = false;
    const conferir = async () => {
      const r = await conferirPix(pix.id).catch(() => null);
      if (parar) return;
      if (r?.pago) {
        setPago(true);
        router.refresh();
      } else if (r && ["cancelled", "rejected", "expired"].includes(r.status)) {
        setPix(null);
        setErro("Este Pix expirou. Gere um novo para pagar.");
      }
    };
    const timer = setInterval(conferir, INTERVALO_CONFERENCIA);
    return () => {
      parar = true;
      clearInterval(timer);
    };
  }, [pix, pago, router]);

  function gerar() {
    setErro(null);
    iniciar(async () => {
      const r = await pagarComPix(plano);
      if (r.ok) setPix(r.pix);
      else setErro(r.erro);
    });
  }

  async function copiar() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.copiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não deu para copiar. Selecione o código abaixo e copie.");
    }
  }

  if (pago) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-acerto/40 bg-acerto-suave px-4 py-3 text-sm font-bold text-acerto">
        <Check className="size-4" aria-hidden /> Pix recebido! Seu acesso foi liberado.
      </p>
    );
  }

  if (!pix) {
    return (
      <div className="space-y-2">
        <Button variante="contorno" className="w-full sm:w-auto" disabled={gerando} onClick={gerar}>
          <QrCode className="size-4" aria-hidden />
          {gerando ? "Gerando o Pix..." : (rotulo ?? `Pagar com Pix: ${formatarReais(valor)} por ${DIAS_PIX} dias`)}
        </Button>
        {erro && <p className="text-sm font-bold text-erro">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-borda bg-camada p-4 sm:p-5">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* Imagem gerada pelo Mercado Pago (base64): não passa pelo otimizador do Next. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pix.imagem} alt="QR code do Pix" width={180} height={180} className="size-44 shrink-0 rounded-xl bg-sobre-marca p-2" />
        <div className="min-w-0 space-y-2 text-sm">
          <p className="text-lg font-extrabold">{formatarReais(pix.valor)}</p>
          <p className="text-texto/85">
            Abra o app do seu banco, escolha <strong>Pix</strong> e leia o QR code, ou use o <strong>Pix copia e cola</strong>.
            Vale {DIAS_PIX} dias de acesso.
          </p>
          <p className="flex items-center gap-2 font-bold text-destaque">
            <span className="size-2 animate-pulse rounded-full bg-destaque" aria-hidden /> Aguardando o pagamento...
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-bold text-suave">Pix copia e cola</p>
        <p className="break-all rounded-lg border border-borda bg-superficie px-3 py-2 font-mono text-xs select-all">{pix.copiaECola}</p>
        <Button className="w-full sm:w-auto" onClick={copiar}>
          {copiado ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copiado ? "Copiado!" : "Copiar código Pix"}
        </Button>
        {erro && <p className="text-sm font-bold text-erro">{erro}</p>}
      </div>
      <p className="text-xs text-suave">O código vale 1 hora. Assim que o banco confirmar, o acesso libera sozinho nesta tela.</p>
    </div>
  );
}
