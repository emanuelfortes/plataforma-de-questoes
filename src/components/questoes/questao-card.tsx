"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StatusAluno } from "@/lib/filtros";
import { cn } from "@/lib/utils";
import { responderQuestao, type ResultadoResposta } from "@/server/acoes";
import type { QuestaoListada } from "@/server/questoes";
import { IconeStatus } from "./icone-status";

export function QuestaoCard({ questao, numero }: { questao: QuestaoListada; numero: number }) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Extract<ResultadoResposta, { ok: true }> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusAluno>(questao.status);
  const [enviando, iniciar] = useTransition();

  function responder() {
    if (!escolhida) return;
    setErro(null);
    iniciar(async () => {
      const r = await responderQuestao(questao.id, escolhida);
      if (!r.ok) return setErro(r.erro);
      setResultado(r);
      setStatus(r.correta ? "acertou" : "errou");
    });
  }

  function refazer() {
    setEscolhida(null);
    setResultado(null);
  }

  return (
    <article className="rounded-xl border border-borda bg-superficie p-5 shadow-xs sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <IconeStatus status={status} />
        <span className="font-semibold tabular-nums text-suave">#{numero}</span>
        <Badge>{questao.disciplina}</Badge>
        {questao.assunto && <Badge>{questao.assunto}</Badge>}
        {(questao.banca || questao.ano) && (
          <span className="ml-auto text-suave">
            {[questao.banca, questao.ano].filter(Boolean).join(" · ")}
          </span>
        )}
      </header>

      <p className="mb-5 whitespace-pre-line leading-relaxed">{questao.enunciado}</p>

      <ul className="space-y-2" role="radiogroup" aria-label="Alternativas">
        {questao.alternativas.map((alt) => {
          const selecionada = escolhida === alt.letra;
          const ehGabarito = resultado?.gabarito === alt.letra;
          const errouEsta = resultado && selecionada && !resultado.correta;
          return (
            <li key={alt.letra}>
              <button
                type="button"
                role="radio"
                aria-checked={selecionada}
                disabled={!!resultado || enviando}
                onClick={() => setEscolhida(alt.letra)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  "disabled:cursor-default",
                  !resultado && selecionada && "border-marca bg-marca-suave",
                  !resultado && !selecionada && "border-borda hover:bg-fundo",
                  ehGabarito && "border-acerto bg-acerto-suave",
                  errouEsta && "border-erro bg-erro-suave",
                  resultado && !ehGabarito && !errouEsta && "border-borda opacity-70",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                    selecionada ? "border-current" : "border-borda",
                  )}
                >
                  {alt.letra}
                </span>
                <span className="pt-0.5">{alt.texto}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="mt-5 space-y-4">
        {erro && <p className="text-sm text-erro">{erro}</p>}

        {!resultado ? (
          <Button onClick={responder} disabled={!escolhida || enviando}>
            {enviando ? "Conferindo..." : "Responder"}
          </Button>
        ) : (
          <div className="space-y-4">
            <p
              className={cn(
                "text-sm font-semibold",
                resultado.correta ? "text-acerto" : "text-erro",
              )}
            >
              {resultado.correta
                ? "Você acertou."
                : `Você errou. Gabarito: ${resultado.gabarito}.`}
            </p>
            {resultado.comentario && (
              <div className="rounded-lg bg-fundo p-4 text-sm leading-relaxed">
                <p className="mb-1 font-medium">Comentário</p>
                <p className="whitespace-pre-line text-suave">{resultado.comentario}</p>
              </div>
            )}
            <Button variante="contorno" tamanho="pequeno" onClick={refazer}>
              Refazer
            </Button>
          </div>
        )}
      </footer>
    </article>
  );
}
