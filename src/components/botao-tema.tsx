"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { COOKIE_TEMA, COR_BARRA, type Tema } from "@/lib/tema";
import { cn } from "@/lib/utils";

function temaAtual(): Tema {
  const escolhido = document.documentElement.dataset.tema;
  if (escolhido === "claro" || escolhido === "escuro") return escolhido;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "escuro";
}

/** Alterna entre a visão clara e a escura e lembra a escolha (cookie de 1 ano). */
export function BotaoTema({ className, comRotulo = false }: { className?: string; comRotulo?: boolean }) {
  const [tema, setTema] = useState<Tema | null>(null);
  useEffect(() => setTema(temaAtual()), []);

  function alternar() {
    const novo: Tema = temaAtual() === "escuro" ? "claro" : "escuro";
    document.documentElement.dataset.tema = novo;
    document.cookie = `${COOKIE_TEMA}=${novo}; path=/; max-age=31536000; samesite=lax`;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", COR_BARRA[novo]));
    setTema(novo);
  }

  const proximo = tema === "escuro" ? "clara" : "escura";
  const Icone = tema === "escuro" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={`Mudar para a visão ${proximo}`}
      title={`Mudar para a visão ${proximo}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl text-suave transition-colors hover:text-texto",
        comRotulo ? "px-3 py-2 text-sm font-bold hover:bg-camada" : "size-10 justify-center hover:bg-camada",
        className,
      )}
    >
      {/* Antes de saber o tema (primeiro desenho), mostra a lua: evita trocar o ícone à toa. */}
      <Icone className="size-5" aria-hidden />
      {comRotulo && <span>Visão {proximo}</span>}
    </button>
  );
}
