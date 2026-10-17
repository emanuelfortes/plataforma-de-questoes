"use client";

import { ArrowRight, Check, CircleCheck, CircleX, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ROTULO_DIFICULDADE } from "@/lib/dificuldade";
import { cn } from "@/lib/utils";
import { responderQuestao, type ResultadoResposta } from "@/server/acoes";
import type { QuestaoListada } from "@/server/questoes";

type Props = {
  questao: QuestaoListada;
  numero: number;
  total?: number;
  progresso?: number; // 0 a 1, posição na página atual
  onProxima?: () => void; // quando existe, mostra "Próxima" após responder (modo uma por vez)
  onPular?: () => void;
};

type Resultado = Extract<ResultadoResposta, { ok: true }>;
type Alternativa = QuestaoListada["alternativas"][number];

// Certo ou errado (estilo Cebraspe) chega como duas alternativas: C "Certo" e E "Errado".
function ehCertoErrado(alternativas: Alternativa[]) {
  const textos = Object.fromEntries(alternativas.map((a) => [a.letra, a.texto.trim().toLowerCase()]));
  return alternativas.length === 2 && textos.C === "certo" && textos.E === "errado";
}

export function QuestaoCard({ questao, numero, total, progresso, onProxima, onPular }: Props) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const refResultado = useRef<HTMLDivElement>(null);

  const certoErrado = ehCertoErrado(questao.alternativas);
  const paragrafos = questao.enunciado.split(/\n\s*\n/);
  const origem = [questao.banca, questao.ano].filter(Boolean).join(" · ");

  // O resultado aparece abaixo das alternativas: traz para a vista (no celular costuma ficar fora da tela).
  useEffect(() => {
    if (!resultado) return;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    refResultado.current?.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "nearest" });
  }, [resultado]);

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

  function estado(letra: string) {
    const selecionada = escolhida === letra;
    if (!resultado) return selecionada ? "selecionada" : "livre";
    if (resultado.gabarito === letra) return "certa";
    if (selecionada) return "errada";
    return "apagada";
  }

  const textoGabarito = certoErrado
    ? questao.alternativas.find((a) => a.letra === resultado?.gabarito)?.texto
    : resultado?.gabarito;

  return (
    <article className="space-y-6">
      {/* 1. progresso  2. matéria e área  3. banca e ano */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-xs font-extrabold tabular-nums text-marca-clara">
            Questão {numero}
            {total && <span className="font-bold text-white/40"> de {total}</span>}
          </span>
          {progresso !== undefined && (
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label="Progresso desta página"
              aria-valuenow={Math.round(progresso * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-marca transition-[width] duration-300" style={{ width: `${progresso * 100}%` }} />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm leading-snug">
            <span className="font-extrabold">{questao.disciplina}</span>
            {questao.assunto && <span className="font-semibold text-suave"> · {questao.assunto}</span>}
          </p>
          {(origem || (resultado && questao.dificuldade)) && (
            <p className="flex flex-wrap items-center gap-x-2 text-xs font-bold uppercase tracking-[.04em] text-white/45">
              {origem && <span>{origem}</span>}
              {/* Nível só depois da resposta: antes seria dica (o aluno deve encarar a questão sem saber). */}
              {resultado && questao.dificuldade && (
                <span className="text-destaque">
                  {origem && <span className="mr-2 text-white/25">·</span>}
                  {ROTULO_DIFICULDADE[questao.dificuldade]}
                </span>
              )}
            </p>
          )}
        </div>
      </header>

      <div className="space-y-4 text-[17px] font-medium leading-[1.7] text-texto sm:text-[19px]">
        {paragrafos.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>

      {certoErrado ? (
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Julgue o item">
          {questao.alternativas.map((alt) => {
            const e = estado(alt.letra);
            // Antes da resposta o ícone identifica a opção; depois, diz se ela era a certa ou a sua errada.
            const Icone = e === "certa" ? CircleCheck : e === "errada" ? CircleX : alt.letra === "C" ? Check : X;
            return (
              <button
                key={alt.letra}
                type="button"
                role="radio"
                aria-checked={escolhida === alt.letra}
                disabled={!!resultado || enviando}
                onClick={() => setEscolhida(alt.letra)}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] text-[15px] font-extrabold transition-[background-color,border-color,opacity,transform] duration-150 motion-safe:active:scale-[.98] disabled:cursor-default",
                  e === "livre" && "border-white/12 bg-white/[.03] text-texto/85 hover:border-white/25 hover:bg-white/[.06]",
                  e === "selecionada" && "border-marca bg-marca-suave text-texto",
                  e === "certa" && "border-acerto bg-acerto-suave text-acerto",
                  e === "errada" && "border-erro bg-erro-suave text-erro",
                  e === "apagada" && "border-white/10 text-texto/40",
                )}
              >
                <Icone className="size-[18px]" strokeWidth={2.5} aria-hidden />
                {alt.texto}
              </button>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-2.5" role="radiogroup" aria-label="Alternativas">
          {questao.alternativas.map((alt) => {
            const e = estado(alt.letra);
            return (
              <li key={alt.letra}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={escolhida === alt.letra}
                  disabled={!!resultado || enviando}
                  onClick={() => setEscolhida(alt.letra)}
                  className={cn(
                    "flex min-h-14 w-full items-start gap-3 rounded-xl border-[1.5px] px-3 py-3 text-left transition-[background-color,border-color,opacity,transform] duration-150 motion-safe:active:scale-[.99] disabled:cursor-default sm:gap-4 sm:px-4",
                    e === "livre" && "border-white/10 bg-white/[.03] hover:border-white/25 hover:bg-white/[.06]",
                    e === "selecionada" && "border-marca bg-marca-suave",
                    e === "certa" && "border-acerto bg-acerto-suave",
                    e === "errada" && "border-erro bg-erro-suave",
                    e === "apagada" && "border-white/[.06] opacity-45",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] text-xs font-extrabold transition-colors duration-150",
                      (e === "livre" || e === "apagada") && "border-white/25 text-texto/70",
                      e === "selecionada" && "border-marca bg-marca text-white",
                      e === "certa" && "border-acerto bg-acerto text-fundo",
                      e === "errada" && "border-erro bg-erro text-fundo",
                    )}
                    aria-hidden
                  >
                    {alt.letra}
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5 text-[15px] leading-relaxed sm:text-base">
                    <span className="sr-only">{alt.letra}) </span>
                    {alt.texto}
                  </span>
                  {e === "certa" && <CircleCheck className="mt-1 size-5 shrink-0 text-acerto" aria-label="Resposta correta" />}
                  {e === "errada" && <CircleX className="mt-1 size-5 shrink-0 text-erro" aria-label="Sua resposta" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {erro && (
        <p role="alert" className="text-sm font-bold text-erro">
          {erro}
        </p>
      )}

      {resultado && (
        <div ref={refResultado} className="scroll-mb-28 space-y-5 md:scroll-mb-8" role="status">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3",
              resultado.correta ? "bg-acerto-suave text-acerto" : "bg-erro-suave text-erro",
            )}
          >
            {resultado.correta ? <CircleCheck className="size-6 shrink-0" aria-hidden /> : <CircleX className="size-6 shrink-0" aria-hidden />}
            <div className="min-w-0">
              <p className="font-extrabold">{resultado.correta ? "Você acertou" : "Você errou"}</p>
              <p className="text-sm font-semibold text-texto/75">Gabarito: {textoGabarito}</p>
            </div>
          </div>
          {resultado.comentario && (
            <section className="border-l-2 border-marca pl-4">
              <h2 className="text-xs font-extrabold uppercase tracking-[.06em] text-marca-clara">Comentário</h2>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-[1.7] text-texto/85">{resultado.comentario}</p>
            </section>
          )}
        </div>
      )}

      {/* Celular: fixa no rodapé, acima da área segura (a página reserva o espaço). Computador: no fluxo.
          Fundo sólido: com transparência o Safari deixa o texto de baixo aparecer atrás dos botões. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-fundo px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:static md:z-auto md:border-0 md:bg-transparent md:p-0">
        {/* Secundária (contorno, 2/5) e principal (cheia, 3/5) com a mesma altura. */}
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          {!resultado ? (
            <>
              {onPular && (
                <Button variante="contorno" onClick={onPular} disabled={enviando} className="h-12 flex-[2] px-4 md:flex-none md:px-8">
                  Pular
                </Button>
              )}
              <Button onClick={responder} disabled={!escolhida || enviando} className="ml-auto h-12 flex-[3] px-4 md:flex-none md:px-12">
                {enviando && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                {enviando ? "Conferindo" : "Responder"}
              </Button>
            </>
          ) : (
            <>
              <Button variante="contorno" onClick={refazer} className="h-12 flex-[2] px-4 md:flex-none md:px-8">
                <RotateCcw className="size-4" aria-hidden />
                Refazer
              </Button>
              {onProxima && (
                <Button onClick={onProxima} className="ml-auto h-12 flex-[3] px-4 md:flex-none md:px-12">
                  Próxima
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
