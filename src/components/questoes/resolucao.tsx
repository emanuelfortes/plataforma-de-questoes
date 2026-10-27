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

/** Questão errada volta depois de tantas outras, para o aluno exercitar a memória. */
const VOLTA_DEPOIS_DE = 4;
/** Quantas vezes a mesma questão pode voltar na página (errou de novo, volta de novo). */
const MAXIMO_VOLTAS = 3;

type Item = { questao: QuestaoListada; numero: number; volta: number };

/** Uma questão por vez. A página inteira já veio do servidor (mesma consulta de hoje); só avançamos no cliente.
 *  Quem erra vê a mesma questão de novo VOLTA_DEPOIS_DE questões adiante (refazer não conta no ranking). */
export function Resolucao({ questoes, inicio, proximaUrl, totalFiltro }: Props) {
  const [fila, setFila] = useState<Item[]>(() => questoes.map((questao, i) => ({ questao, numero: inicio + i, volta: 0 })));
  const [indice, setIndice] = useState(0);
  const refTopo = useRef<HTMLDivElement>(null);
  const item = fila[indice];
  const atual = item?.questao;
  const avancar = () => setIndice((i) => i + 1);

  function respondida(correta: boolean) {
    if (correta || !item || item.volta >= MAXIMO_VOLTAS) return;
    setFila((f) => {
      // Só agenda uma vez por resposta, mesmo se o aluno usar "Refazer" e errar de novo na mesma tela.
      const ja = f.some((x, i) => i > indice && x.questao.id === item.questao.id);
      if (ja) return f;
      const novo = { ...item, volta: item.volta + 1 };
      const posicao = Math.min(indice + 1 + VOLTA_DEPOIS_DE, f.length);
      return [...f.slice(0, posicao), novo, ...f.slice(posicao)];
    });
  }

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
        key={`${atual.id}-${item.volta}`}
        questao={atual}
        numero={item.numero}
        total={Math.max(totalFiltro, inicio + questoes.length - 1)}
        progresso={(item.numero - 1) / Math.max(totalFiltro, inicio + questoes.length - 1)}
        onProxima={avancar}
        onPular={avancar}
        onRespondida={respondida}
        revisao={item.volta > 0}
      />
    </div>
  );
}
