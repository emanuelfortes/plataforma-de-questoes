"use client";

import { useState, useTransition } from "react";
import { definirMonitor } from "@/server/acoes-admin";

/** Liga ou desliga o cargo de monitor de uma pessoa (lista de /admin/pessoas). */
export function BotaoMonitor({ usuarioId, monitor }: { usuarioId: string; monitor: boolean }) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={enviando}
        onClick={() => {
          if (monitor && !confirm("Tirar o cargo de monitor? A pessoa volta para o plano dela (grátis ou assinatura).")) return;
          setErro(null);
          iniciar(async () => {
            const r = await definirMonitor({ usuarioId, monitor: !monitor });
            if (!r.ok) setErro(r.erro ?? "Não deu certo.");
          });
        }}
        className="whitespace-nowrap rounded-lg border border-borda px-2.5 py-1 text-xs font-bold text-texto/80 hover:bg-camada-forte disabled:opacity-50"
      >
        {enviando ? "Salvando..." : monitor ? "Tirar monitor" : "Tornar monitor"}
      </button>
      {erro && <span className="text-xs font-bold text-erro">{erro}</span>}
    </span>
  );
}
