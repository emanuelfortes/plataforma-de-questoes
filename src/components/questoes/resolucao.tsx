"use client";

import Link from "next/link";
import { useState } from "react";
import { variantesBotao } from "@/components/ui/button";
import type { QuestaoListada } from "@/server/questoes";
import { QuestaoCard } from "./questao-card";

type Props = {
  questoes: QuestaoListada[];
  inicio: number; // número da primeira questão desta página
  proximaUrl: string | null;
};

/** Uma questão por vez. A página inteira já veio do servidor (mesma consulta de hoje); só avançamos no cliente. */
export function Resolucao({ questoes, inicio, proximaUrl }: Props) {
  const [indice, setIndice] = useState(0);
  const atual = questoes[indice];
  const avancar = () => setIndice((i) => i + 1);

  if (!atual) {
    return (
      <div className="rounded-2xl border border-borda bg-white/5 p-10 text-center">
        <p className="text-lg font-extrabold">Você fechou esta página.</p>
        <p className="mt-1 text-sm text-suave">{questoes.length} questões resolvidas aqui. Continue para a próxima.</p>
        {proximaUrl && (
          <Link href={proximaUrl} className={variantesBotao({ tamanho: "grande", className: "mt-6 px-9" })}>
            Próxima página
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={indice} aria-valuemax={questoes.length}>
        <div className="h-full bg-marca transition-[width]" style={{ width: `${(indice / questoes.length) * 100}%` }} />
      </div>
      <QuestaoCard
        key={atual.id}
        questao={atual}
        numero={inicio + indice}
        total={inicio + questoes.length - 1}
        onProxima={avancar}
        onPular={avancar}
      />
    </div>
  );
}
