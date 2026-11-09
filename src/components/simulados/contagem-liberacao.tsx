"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Contagem regressiva até a liberação do simulado. Ao zerar, recarrega os dados da página (o servidor passa a
// listar o simulado como disponível). Antes de montar no navegador mostra traços, para não divergir do servidor.

const doisDigitos = (n: number) => String(n).padStart(2, "0");

export function ContagemLiberacao({ liberaEm }: { liberaEm: string }) {
  const router = useRouter();
  const alvo = new Date(liberaEm).getTime();
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => {
    setAgora(Date.now());
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const restante = agora === null ? null : Math.max(0, Math.floor((alvo - agora) / 1000));

  useEffect(() => {
    if (restante !== 0) return;
    // Pequena folga para o relógio do aparelho não estar à frente do servidor.
    const t = setTimeout(() => router.refresh(), 1500);
    return () => clearTimeout(t);
  }, [restante, router]);

  if (restante === 0) {
    return <p className="text-sm font-extrabold text-acerto">Liberando...</p>;
  }

  const dias = restante === null ? null : Math.floor(restante / 86400);
  const partes =
    restante === null
      ? [
          ["--", "h"],
          ["--", "min"],
          ["--", "s"],
        ]
      : [
          ...(dias ? [[String(dias), dias === 1 ? "dia" : "dias"]] : []),
          [doisDigitos(Math.floor((restante % 86400) / 3600)), "h"],
          [doisDigitos(Math.floor((restante % 3600) / 60)), "min"],
          [doisDigitos(restante % 60), "s"],
        ];

  return (
    <div className="flex gap-1.5" role="timer" aria-label="Tempo até a liberação">
      {partes.map(([valor, unidade]) => (
        <span key={unidade} className="min-w-12 rounded-lg border border-borda bg-camada px-2 py-1 text-center">
          <span className="block text-lg font-extrabold tabular-nums leading-tight">{valor}</span>
          <span className="block text-[10px] font-bold uppercase tracking-[.06em] text-suave">{unidade}</span>
        </span>
      ))}
    </div>
  );
}
