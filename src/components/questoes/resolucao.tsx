"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { variantesBotao } from "@/components/ui/button";
import type { QuestaoListada } from "@/server/questoes";
import { QuestaoCard, type RespostaSalva } from "./questao-card";

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
  const voltar = () => setIndice((i) => Math.max(0, i - 1));
  // Respostas desta página, por item da fila: ao voltar com a seta, a questão aparece como ficou.
  const [salvas, setSalvas] = useState<Record<string, RespostaSalva>>({});
  const chave = item ? `${item.questao.id}-${item.volta}` : "";

  function salvar(resposta: RespostaSalva | null) {
    setSalvas((s) => {
      const nova = { ...s };
      if (resposta) nova[chave] = resposta;
      else delete nova[chave];
      return nova;
    });
  }

  // No computador, as setas do teclado fazem o mesmo que as setas da tela (fora de campos de texto).
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement;
      if (e.altKey || e.ctrlKey || e.metaKey || alvo.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight") setIndice((i) => Math.min(i + 1, fila.length));
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fila.length]);
  // Erros seguidos (para a frase do 3º erro): acerto zera; só soma resposta que conta (não refazer nem chute).
  const [errosSeguidos, setErrosSeguidos] = useState(0);

  function respondida(correta: boolean, conta: boolean) {
    if (correta) setErrosSeguidos(0);
    else if (conta) setErrosSeguidos((n) => n + 1);
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
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={voltar} className={variantesBotao({ variante: "contorno", tamanho: "grande", className: "w-full px-9 sm:w-auto" })}>
            Voltar à última questão
          </button>
          {proximaUrl && (
            <Link href={proximaUrl} className={variantesBotao({ tamanho: "grande", className: "w-full px-9 sm:w-auto" })}>
              Próxima página
            </Link>
          )}
        </div>
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
        onAnterior={indice > 0 ? voltar : undefined}
        onProxima={avancar}
        salva={salvas[chave]}
        onSalvar={salvar}
        onRespondida={respondida}
        revisao={item.volta > 0}
        errosSeguidos={errosSeguidos}
      />
    </div>
  );
}
