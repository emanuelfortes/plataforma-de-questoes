"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { avaliarFlashcard } from "@/server/acoes";
import type { CardSessao } from "@/server/flashcards";

const NOTAS = [
  { nota: 1, rotulo: "Errei", classe: "border-erro text-erro hover:bg-erro-suave" },
  { nota: 2, rotulo: "Difícil", classe: "border-borda hover:bg-fundo" },
  { nota: 3, rotulo: "Bom", classe: "border-borda hover:bg-fundo" },
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
      <div className="rounded-xl border border-borda bg-superficie p-10 text-center">
        <p className="text-lg font-semibold">Sessão concluída</p>
        <p className="mt-1 text-sm text-suave">
          {cards.length
            ? `Você revisou ${cards.length} cards. Volte depois para as próximas revisões.`
            : "Nenhum card para revisar agora."}
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
      <div className="flex items-center justify-between text-sm text-suave">
        <span className="tabular-nums">
          {indice + 1} de {cards.length}
        </span>
        <span className="flex gap-2">
          <Badge>{atual.disciplina}</Badge>
          <Badge className={atual.tipo === "novo" ? "bg-marca-suave text-marca-forte" : ""}>
            {atual.tipo === "novo" ? "Novo" : "Revisão"}
          </Badge>
        </span>
      </div>

      <button
        type="button"
        onClick={() => setVirado((v) => !v)}
        className="cena-card block w-full text-left"
        aria-label={virado ? "Mostrar frente" : "Mostrar resposta"}
      >
        <div className="card-giro relative min-h-64" data-virado={virado}>
          <div className="card-face absolute inset-0 flex flex-col rounded-xl border border-borda bg-superficie p-6 shadow-xs">
            <span className="text-xs font-medium uppercase tracking-wide text-suave">Frente</span>
            <p className="m-auto whitespace-pre-line text-center text-lg leading-relaxed">
              {atual.frente}
            </p>
            <span className="text-center text-xs text-suave">Toque para ver a resposta</span>
          </div>
          <div className="card-face card-verso absolute inset-0 flex flex-col rounded-xl border border-marca bg-marca-suave p-6">
            <span className="text-xs font-medium uppercase tracking-wide text-marca-forte">
              Verso
            </span>
            <p className="m-auto whitespace-pre-line text-center text-lg leading-relaxed">
              {atual.verso}
            </p>
          </div>
        </div>
      </button>

      {erro && <p className="text-sm text-erro">{erro}</p>}

      <div
        className={cn(
          "grid grid-cols-4 gap-2 transition-opacity",
          !virado && "pointer-events-none opacity-40",
        )}
        aria-hidden={!virado}
      >
        {NOTAS.map(({ nota, rotulo, classe }) => (
          <Button
            key={nota}
            variante="contorno"
            className={classe}
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
