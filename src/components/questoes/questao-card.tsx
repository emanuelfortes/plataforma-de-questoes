"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ROTULO_DIFICULDADE } from "@/lib/dificuldade";
import { cn } from "@/lib/utils";
import { responderQuestao, type ResultadoResposta } from "@/server/acoes";
import type { QuestaoListada } from "@/server/questoes";

type Props = {
  questao: QuestaoListada;
  numero: number;
  total?: number;
  onProxima?: () => void; // quando existe, mostra "Próxima" após responder (modo uma por vez)
  onPular?: () => void;
};

export function QuestaoCard({ questao, numero, total, onProxima, onPular }: Props) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Extract<ResultadoResposta, { ok: true }> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function responder() {
    if (!escolhida) return;
    setErro(null);
    iniciar(async () => {
      const r = await responderQuestao(questao.id, escolhida);
      if (!r.ok) return setErro(r.erro);
      setResultado(r);
    });
  }

  function refazer() {
    setEscolhida(null);
    setResultado(null);
  }

  return (
    <article className="space-y-5">
      <header className="flex flex-wrap items-center gap-2.5 text-xs">
        <span className="text-sm font-extrabold text-marca">
          Questão {numero}
          {total && <span className="text-white/40"> / {total}</span>}
        </span>
        <span className="rounded-md bg-marca-suave px-2 py-1 font-extrabold text-marca-clara">{questao.disciplina}</span>
        {questao.assunto && <span className="font-bold text-suave">{questao.assunto}</span>}
        {/* Nível só depois da resposta: antes seria dica (o aluno deve encarar a questão sem saber). */}
        {resultado && questao.dificuldade && (
          <span className="rounded-md bg-destaque-suave px-2 py-1 font-extrabold text-destaque">
            {ROTULO_DIFICULDADE[questao.dificuldade]}
          </span>
        )}
        {(questao.banca || questao.ano) && (
          <span className="ml-auto font-bold text-white/50">{[questao.banca, questao.ano].filter(Boolean).join(" · ")}</span>
        )}
      </header>

      <p className="whitespace-pre-line text-[22px] font-semibold leading-[1.55]">{questao.enunciado}</p>

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
                  "flex w-full items-center gap-3.5 rounded-xl border-[1.5px] px-4 py-3.5 text-left text-[15px] transition-colors disabled:cursor-default",
                  !resultado && selecionada && "border-marca bg-marca-suave",
                  !resultado && !selecionada && "border-borda bg-white/[.04] hover:bg-white/[.08]",
                  ehGabarito && "border-acerto bg-acerto-suave",
                  errouEsta && "border-erro bg-erro-suave",
                  resultado && !ehGabarito && !errouEsta && "border-borda opacity-50",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg text-[13px] font-extrabold",
                    ehGabarito ? "bg-acerto text-fundo" : errouEsta ? "bg-erro text-fundo" : selecionada ? "bg-marca text-white" : "bg-white/10",
                  )}
                >
                  {alt.letra}
                </span>
                <span>{alt.texto}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="space-y-4">
        {erro && <p className="text-sm text-erro">{erro}</p>}

        {!resolvido(resultado) ? (
          <div className="flex items-center justify-between">
            {onPular ? (
              <button type="button" onClick={onPular} className="px-3 text-sm font-bold text-suave hover:text-texto">
                Pular esta
              </button>
            ) : (
              <span />
            )}
            <Button tamanho="grande" onClick={responder} disabled={!escolhida || enviando} className="px-9 shadow-[0_8px_24px_rgba(47,107,255,.4)]">
              {enviando ? "Conferindo..." : "Responder"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className={cn("flex items-center gap-2 text-[15px] font-extrabold", resultado.correta ? "text-acerto" : "text-erro")}>
              {resultado.correta ? <CircleCheck className="size-5" /> : <CircleX className="size-5" />}
              {resultado.correta ? "Você acertou." : `Você errou. Gabarito: ${resultado.gabarito}.`}
            </p>
            {resultado.comentario && (
              <div className="rounded-r-xl border-l-[3px] border-marca bg-white/5 p-4 text-sm leading-relaxed">
                <p className="mb-1 font-extrabold text-marca-clara">Comentário</p>
                <p className="whitespace-pre-line text-texto/80">{resultado.comentario}</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button variante="contorno" tamanho="pequeno" onClick={refazer}>Refazer</Button>
              {onProxima && (
                <Button tamanho="grande" onClick={onProxima} className="px-9">Próxima</Button>
              )}
            </div>
          </div>
        )}
      </footer>
    </article>
  );
}

function resolvido(r: unknown): r is Extract<ResultadoResposta, { ok: true }> {
  return !!r;
}
