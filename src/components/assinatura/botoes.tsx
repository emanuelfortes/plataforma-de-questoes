"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { assinar, cancelar } from "@/server/acoes-assinatura";

export function BotaoAssinar({ rotulo = "Assinar agora" }: { rotulo?: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        tamanho="grande"
        className="w-full shadow-lg shadow-marca/30 sm:w-auto sm:px-10"
        disabled={enviando}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const r = await assinar();
            if (!r.ok) return setErro(r.erro);
            window.location.href = r.url; // checkout do Mercado Pago
          })
        }
      >
        {enviando ? "Abrindo o pagamento..." : rotulo}
      </Button>
      {erro && <p className="text-sm font-bold text-erro">{erro}</p>}
    </div>
  );
}

export function BotaoCancelar() {
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  if (!confirmar) {
    return (
      <button type="button" onClick={() => setConfirmar(true)} className="text-sm font-bold text-suave hover:text-erro">
        Cancelar assinatura
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-xl border border-erro/40 bg-erro-suave p-4 text-sm">
      <p>
        Tem certeza? Você continua com acesso até o fim do período já pago, e as próximas cobranças não acontecem.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variante="contorno"
          className="text-erro"
          disabled={enviando}
          onClick={() =>
            iniciar(async () => {
              const r = await cancelar();
              if (!r.ok) setErro(r.erro ?? "Não foi possível cancelar.");
            })
          }
        >
          {enviando ? "Cancelando..." : "Sim, cancelar"}
        </Button>
        <Button variante="fantasma" onClick={() => setConfirmar(false)} disabled={enviando}>
          Manter assinatura
        </Button>
      </div>
      {erro && <p className="font-bold text-erro">{erro}</p>}
    </div>
  );
}
