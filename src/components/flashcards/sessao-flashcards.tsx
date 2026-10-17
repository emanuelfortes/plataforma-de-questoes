"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { avaliarFlashcard } from "@/server/acoes";
import type { CardSessao } from "@/server/flashcards";

const NOTAS = [
  { nota: 1, rotulo: "Errei", classe: "border-erro text-erro hover:bg-erro-suave" },
  { nota: 2, rotulo: "Difícil", classe: "border-white/20 text-texto hover:bg-white/10" },
  { nota: 3, rotulo: "Bom", classe: "border-white/20 text-texto hover:bg-white/10" },
  { nota: 4, rotulo: "Fácil", classe: "border-acerto text-acerto hover:bg-acerto-suave" },
] as const;

export function SessaoFlashcards({ cards }: { cards: CardSessao[] }) {
  const [indice, setIndice] = useState(0);
  const [virado, setVirado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  const atual = cards[indice];

  if (!atual) {
    return (
      <div className="rounded-2xl border border-borda bg-white/5 p-10 text-center">
        <p className="text-lg font-extrabold">Sessão concluída</p>
        <p className="mt-1 text-sm text-suave">
          {cards.length ? `Você revisou ${cards.length} cards. Volte depois para as próximas revisões.` : "Nenhum card para revisar agora."}
        </p>
      </div>
    );
  }

  function avaliar(nota: number) {
    if (!atual) return;
    setErro(null);
    iniciar(async () => {
      const r = await avaliarFlashcard(atual.id, nota);
      if (!r.ok) return setErro(r.erro);
      setVirado(false);
      setIndice((i) => i + 1);
    });
  }

  return (
    <div className="space-y-4">
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-marca transition-[width]" style={{ width: `${(indice / cards.length) * 100}%` }} />
      </div>

      <button
        type="button"
        onClick={() => setVirado((v) => !v)}
        className="cena-card block w-full text-left"
        aria-label={virado ? "Mostrar frente" : "Mostrar resposta"}
      >
        {/* As duas faces ocupam a mesma célula do grid: o card cresce até a face com mais texto. */}
        <div className="card-giro grid" data-virado={virado}>
          <div className="card-face flex min-h-[280px] flex-col gap-4 rounded-[20px] bg-white p-5 text-[#0B1733] shadow-[0_20px_50px_rgba(0,0,0,.35)] [grid-area:1/1] sm:min-h-[300px] sm:p-8">
            <div className="flex items-start justify-between gap-3 text-xs font-extrabold">
              <span className="min-w-0 truncate uppercase tracking-[.08em] text-[#5B6B8C]">Frente · {atual.disciplina}</span>
              <span className="shrink-0 text-marca">
                {indice + 1} / {cards.length} · {atual.tipo === "novo" ? "Novo" : "Revisão"}
              </span>
            </div>
            <p className="m-auto max-w-[480px] whitespace-pre-line text-center text-xl font-bold leading-[1.4] sm:text-[26px]">{atual.frente}</p>
            <span className="text-center text-[13px] font-bold text-[#5B6B8C]">Toque para ver a resposta</span>
          </div>
          <div className="card-face card-verso flex min-h-[280px] flex-col gap-4 rounded-[20px] bg-marca p-5 text-white [grid-area:1/1] sm:min-h-[300px] sm:p-8">
            <span className="text-xs font-extrabold uppercase tracking-[.08em] text-white/70">Verso</span>
            <p className="m-auto max-w-[480px] whitespace-pre-line text-center text-xl font-bold leading-[1.4] sm:text-[26px]">{atual.verso}</p>
          </div>
        </div>
      </button>

      {erro && <p className="text-sm text-erro">{erro}</p>}

      <div className={cn("grid grid-cols-4 gap-2 transition-opacity", !virado && "pointer-events-none opacity-50")} aria-hidden={!virado}>
        {NOTAS.map(({ nota, rotulo, classe }) => (
          <Button
            key={nota}
            variante="contorno"
            className={cn("h-[50px] rounded-xl border-[1.5px] bg-transparent px-1 font-extrabold", classe)}
            disabled={!virado || salvando}
            onClick={() => avaliar(nota)}
          >
            {rotulo}
          </Button>
        ))}
      </div>
    </div>
  );
}
