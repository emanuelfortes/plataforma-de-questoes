"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { variantesBotao } from "@/components/ui/button";
import type { QuestaoListada } from "@/server/questoes";
import { QuestaoCard } from "./questao-card";

type Props = {
  questoes: QuestaoListada[];
  inicio: number; // número da primeira questão desta página
  /** Quantas questões o filtro tem no total (o "de N" do cabeçalho). A página traz só 20 por vez. */
  totalFiltro: number;
  proximaUrl: string | null;
};

/** Uma questão por vez. A página inteira já veio do servidor (mesma consulta de hoje); só avançamos no cliente. */
export function Resolucao({ questoes, inicio, proximaUrl, totalFiltro }: Props) {
  const [indice, setIndice] = useState(0);
  const refTopo = useRef<HTMLDivElement>(null);
  const atual = questoes[indice];
  const avancar = () => setIndice((i) => i + 1);

  // Ao avançar, a próxima questão começa do topo (o aluno estava lá embaixo, no comentário).
  const indiceAnterior = useRef(indice);
  useEffect(() => {
    if (indiceAnterior.current === indice) return;
    indiceAnterior.current = indice;
    refTopo.current?.scrollIntoView({ block: "start" });
  }, [indice]);

  if (!atual) {
    return (
      <div ref={refTopo} className="scroll-mt-20 rounded-2xl border border-borda bg-camada p-8 text-center sm:p-10">
        <p className="text-lg font-extrabold">Você fechou esta página.</p>
        <p className="mt-1 text-sm text-suave">{questoes.length} questões resolvidas aqui. Continue para a próxima.</p>
        {proximaUrl && (
          <Link href={proximaUrl} className={variantesBotao({ tamanho: "grande", className: "mt-6 w-full px-9 sm:w-auto" })}>
            Próxima página
          </Link>
        )}
      </div>
    );
  }

  return (
    <div ref={refTopo} className="scroll-mt-20">
      <QuestaoCard
        key={atual.id}
        questao={atual}
        numero={inicio + indice}
        total={Math.max(totalFiltro, inicio + questoes.length - 1)}
        progresso={(inicio + indice - 1) / Math.max(totalFiltro, inicio + questoes.length - 1)}
        onProxima={avancar}
        onPular={avancar}
      />
    </div>
  );
}
