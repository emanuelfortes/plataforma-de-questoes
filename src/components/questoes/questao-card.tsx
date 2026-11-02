"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  CircleX,
  Crosshair,
  LoaderCircle,
  RotateCcw,
  Scissors,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { Fogo } from "@/components/fogo";
import { Rajada } from "@/components/tiros";
import { ReportarErro } from "@/components/reportar-erro";
import { ComentarioQuestao } from "./comentario-questao";
import { Button, variantesBotao } from "@/components/ui/button";
import { ROTULO_DIFICULDADE } from "@/lib/dificuldade";
import { SEGUNDOS_CHUTE } from "@/lib/patentes";
import { cn } from "@/lib/utils";
import { responderQuestao, type ResultadoResposta } from "@/server/acoes";
import type { QuestaoListada } from "@/server/questoes";

type Props = {
  questao: QuestaoListada;
  numero: number;
  total?: number;
  progresso?: number; // 0 a 1, posição na página atual
  /** Setas (como no TEC): sem `onAnterior` a seta de voltar fica desligada. A de avançar também serve de "pular". */
  onAnterior?: () => void;
  onProxima?: () => void;
  /** Resposta já dada nesta sessão (ao voltar para a questão, ela aparece respondida). */
  salva?: RespostaSalva;
  /** Avisado quando a resposta muda (respondeu ou refez), para a resolução guardar. */
  onSalvar?: (resposta: RespostaSalva | null) => void;
  /** Avisado a cada resposta (a resolução usa para trazer de volta a questão errada e contar erros seguidos).
   *  `conta`: resposta que vale para o ranking (primeira vez na questão e não foi chute). */
  onRespondida?: (correta: boolean, conta: boolean) => void;
  /** Questão que voltou para revisão porque o aluno errou há pouco. */
  revisao?: boolean;
  /** Erros seguidos nesta sessão, contando a resposta atual (a frase aparece no 3º). */
  errosSeguidos?: number;
};

// Frases de efeito: aparecem só no momento exato (3º e 5º acerto seguido, 3º erro seguido).
const FRASE_ACERTOS: Record<number, string> = {
  3: "Boa, Papai! 3 acertos 👏🏻",
  5: "5 acertos, Papai? Já vejo o senhor fardado",
};
const FRASE_ERROS = "Mais atenção, Papai! A prova é malvada e não perdoa";

type Resultado = Extract<ResultadoResposta, { ok: true }>;
export type RespostaSalva = { escolhida: string; resultado: Resultado };
type Alternativa = QuestaoListada["alternativas"][number];

// Certo ou errado (estilo Cebraspe) chega como duas alternativas: C "Certo" e E "Errado".
function ehCertoErrado(alternativas: Alternativa[]) {
  const textos = Object.fromEntries(alternativas.map((a) => [a.letra, a.texto.trim().toLowerCase()]));
  return alternativas.length === 2 && textos.C === "certo" && textos.E === "errado";
}

export function QuestaoCard(props: Props) {
  const { questao, numero, total, progresso, onAnterior, onProxima, salva, onSalvar, onRespondida, revisao, errosSeguidos } = props;
  const [escolhida, setEscolhida] = useState<string | null>(salva?.escolhida ?? null);
  const [resultado, setResultado] = useState<Resultado | null>(salva?.resultado ?? null);
  // Respondida agora (não restaurada ao voltar): só então o resultado rola para a vista e as frases aparecem.
  const [agora, setAgora] = useState(false);
  // O comentário fica fechado; o aluno abre se quiser (como o "Ver resolução" do TEC).
  const [verComentario, setVerComentario] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [noLimite, setNoLimite] = useState(false);
  const [enviando, iniciar] = useTransition();
  const refResultado = useRef<HTMLDivElement>(null);
  // Tesourinha (como no TEC): alternativas que o aluno já descartou ficam riscadas. Só na tela, não vai ao servidor.
  const [cortadas, setCortadas] = useState<Set<string>>(() => new Set());
  const ultimoToque = useRef<{ letra: string; quando: number } | null>(null);

  const certoErrado = ehCertoErrado(questao.alternativas);
  const paragrafos = questao.enunciado.split(/\n\s*\n/);
  const origem = [questao.banca, questao.ano].filter(Boolean).join(" · ");

  // O resultado aparece abaixo das alternativas: traz para a vista (no celular costuma ficar fora da tela).
  useEffect(() => {
    if (!resultado || !agora) return;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    refResultado.current?.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "nearest" });
  }, [resultado, agora]);

  function responder() {
    if (!escolhida) return;
    setErro(null);
    iniciar(async () => {
      const r = await responderQuestao(questao.id, escolhida);
      if (!r.ok) {
        setNoLimite(!!r.limite);
        return setErro(r.erro);
      }
      setResultado(r);
      setAgora(true);
      onSalvar?.({ escolhida, resultado: r });
      onRespondida?.(r.correta, r.sequencia !== null);
    });
  }

  function refazer() {
    setEscolhida(null);
    setResultado(null);
    setVerComentario(false);
    setCortadas(new Set());
    onSalvar?.(null);
  }

  function alternarCorte(letra: string) {
    setCortadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(letra)) nova.delete(letra);
      else nova.add(letra);
      return nova;
    });
    setEscolhida((e) => (e === letra ? null : e));
  }

  // Um toque escolhe; dois toques seguidos na mesma alternativa riscam (o dblclick não é confiável no celular).
  function tocarAlternativa(letra: string) {
    const agora = Date.now();
    const anterior = ultimoToque.current;
    ultimoToque.current = { letra, quando: agora };
    if (anterior?.letra === letra && agora - anterior.quando < 350) {
      ultimoToque.current = null;
      return alternarCorte(letra);
    }
    // Escolher uma alternativa riscada tira o risco.
    if (cortadas.has(letra)) alternarCorte(letra);
    setEscolhida(letra);
  }

  function estado(letra: string) {
    const selecionada = escolhida === letra;
    if (!resultado) return selecionada ? "selecionada" : "livre";
    if (resultado.gabarito === letra) return "certa";
    if (selecionada) return "errada";
    return "apagada";
  }

  const sequencia = resultado?.correta ? (resultado.sequencia ?? 0) : 0;
  const fraseAcerto = agora ? FRASE_ACERTOS[sequencia] : undefined;
  const fraseErro = agora && resultado && !resultado.correta && resultado.sequencia !== null && errosSeguidos === 3 ? FRASE_ERROS : undefined;

  const textoGabarito = certoErrado
    ? questao.alternativas.find((a) => a.letra === resultado?.gabarito)?.texto
    : resultado?.gabarito;

  return (
    // touch-manipulation: sem ele, o toque duplo (riscar alternativa) dá zoom no celular.
    <article className="touch-manipulation space-y-6">
      {/* 1. progresso  2. matéria e área  3. banca e ano */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-xs font-extrabold tabular-nums text-marca-clara">
            Questão {numero}
            {total && <span className="font-bold text-suave"> de {total}</span>}
          </span>
          {revisao && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-destaque-suave px-2 py-0.5 text-[11px] font-extrabold text-destaque">
              <RotateCcw className="size-3" aria-hidden />
              Revisão
            </span>
          )}
          {progresso !== undefined && (
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-camada-forte"
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
            <p className="flex flex-wrap items-center gap-x-2 text-xs font-bold uppercase tracking-[.04em] text-suave">
              {origem && <span>{origem}</span>}
              {/* Nível só depois da resposta: antes seria dica (o aluno deve encarar a questão sem saber). */}
              {resultado && questao.dificuldade && (
                <span className="text-destaque">
                  {origem && <span className="mr-2 text-suave">·</span>}
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
                  e === "livre" && "border-borda bg-superficie text-texto/85 hover:border-borda-forte hover:bg-camada",
                  e === "selecionada" && "border-marca bg-marca-suave text-texto",
                  e === "certa" && "border-acerto bg-acerto-suave text-acerto",
                  e === "errada" && "border-erro bg-erro-suave text-erro",
                  e === "apagada" && "border-borda text-texto/40",
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
            const cortada = !resultado && cortadas.has(alt.letra);
            return (
              <li key={alt.letra} className="flex items-start gap-1.5">
                <button
                  type="button"
                  role="radio"
                  aria-checked={escolhida === alt.letra}
                  disabled={!!resultado || enviando}
                  onClick={() => tocarAlternativa(alt.letra)}
                  className={cn(
                    "flex min-h-14 min-w-0 flex-1 items-start gap-3 rounded-xl border-[1.5px] px-3 py-3 text-left transition-[background-color,border-color,opacity,transform] duration-150 motion-safe:active:scale-[.99] disabled:cursor-default sm:gap-4 sm:px-4",
                    e === "livre" && !cortada && "border-borda bg-superficie hover:border-borda-forte hover:bg-camada",
                    cortada && "border-dashed border-borda bg-transparent opacity-50",
                    e === "selecionada" && "border-marca bg-marca-suave",
                    e === "certa" && "border-acerto bg-acerto-suave",
                    e === "errada" && "border-erro bg-erro-suave",
                    e === "apagada" && "border-borda opacity-45",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] text-xs font-extrabold transition-colors duration-150",
                      (e === "livre" || e === "apagada") && "border-borda-forte text-texto/70",
                      e === "selecionada" && "border-marca bg-marca text-sobre-marca",
                      e === "certa" && "border-acerto bg-acerto text-fundo",
                      e === "errada" && "border-erro bg-erro text-fundo",
                    )}
                    aria-hidden
                  >
                    {alt.letra}
                  </span>
                  <span className={cn("min-w-0 flex-1 pt-0.5 text-[15px] leading-relaxed sm:text-base", cortada && "line-through decoration-2")}>
                    <span className="sr-only">{alt.letra}) </span>
                    {cortada && <span className="sr-only">(riscada) </span>}
                    {alt.texto}
                  </span>
                  {e === "certa" && <CircleCheck className="mt-1 size-5 shrink-0 text-acerto" aria-label="Resposta correta" />}
                  {e === "errada" && <CircleX className="mt-1 size-5 shrink-0 text-erro" aria-label="Sua resposta" />}
                </button>
                {!resultado && (
                  <button
                    type="button"
                    onClick={() => alternarCorte(alt.letra)}
                    disabled={enviando}
                    aria-pressed={cortada}
                    aria-label={cortada ? `Desfazer o risco da alternativa ${alt.letra}` : `Riscar a alternativa ${alt.letra}`}
                    title={cortada ? "Desfazer o risco" : "Riscar (descartar) esta alternativa"}
                    className={cn(
                      "grid size-10 shrink-0 place-items-center self-center rounded-xl transition-colors",
                      cortada ? "bg-marca-suave text-marca-clara" : "text-suave hover:bg-camada hover:text-texto",
                    )}
                  >
                    <Scissors className="size-[18px]" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
          {!resultado && (
            <li className="pt-0.5 text-center text-xs text-suave">Toque duas vezes ou na tesoura para riscar uma alternativa.</li>
          )}
        </ul>
      )}

      {erro && noLimite && (
        <div role="alert" className="space-y-3 rounded-2xl border border-destaque/40 bg-destaque-suave p-5">
          <p className="font-extrabold text-destaque">Limite grátis de hoje atingido</p>
          <p className="text-sm text-texto/85">{erro}</p>
          <Link href="/assinatura" className={variantesBotao({ className: "w-full sm:w-auto" })}>
            Ver assinatura
          </Link>
        </div>
      )}

      {erro && !noLimite && (
        <p role="alert" className="text-sm font-bold text-erro">
          {erro}
        </p>
      )}

      {resultado && (
        <div ref={refResultado} className="scroll-mb-6 space-y-5" role="status">
          {fraseAcerto && (
            // Rajada: um tiro na parede por acerto (3 ou 5), com tranco no cartão a cada um.
            <div
              className="rajada relative overflow-hidden rounded-2xl border border-borda bg-camada px-14 py-11 text-center"
              style={{ "--tiros": sequencia >= 5 ? 5 : 3 } as CSSProperties}
            >
              <Rajada tiros={sequencia >= 5 ? 5 : 3} />
              <Crosshair className="relative mx-auto size-8 text-fogo" aria-hidden />
              <p className="relative mt-2 text-xl font-extrabold leading-snug text-texto sm:text-2xl">{fraseAcerto}</p>
            </div>
          )}
          {fraseErro && (
            <div className="tremer flex items-center gap-3 rounded-2xl border border-erro/50 bg-erro-suave px-5 py-4">
              <TriangleAlert className="size-7 shrink-0 text-erro" aria-hidden />
              <p className="text-lg font-extrabold leading-snug text-texto">{fraseErro}</p>
            </div>
          )}
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
              {resultado.comentario && (
                <button
                  type="button"
                  onClick={() => setVerComentario((v) => !v)}
                  aria-expanded={verComentario}
                  className="mt-1 flex items-center gap-1 text-sm font-extrabold text-marca-clara hover:underline"
                >
                  {verComentario ? "Esconder comentário" : "Ver comentário"}
                  <ChevronDown className={cn("size-4 transition-transform", verComentario && "rotate-180")} aria-hidden />
                </button>
              )}
            </div>
            {/* Sequência de acertos (a partir de 2), como a sequência de dias do GitHub */}
            {sequencia >= 2 && (
              <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-fogo/15 px-3 py-1 text-sm font-extrabold text-fogo">
                <Fogo className="text-base" intenso={sequencia >= 5} />
                <span className="tabular-nums">{sequencia}</span>
                <span className="hidden sm:inline">seguidas</span>
                <span className="sr-only sm:hidden">acertos seguidos</span>
              </span>
            )}
          </div>
          {resultado.chute && (
            <p className="-mt-3 text-xs text-suave">
              Resposta em menos de {SEGUNDOS_CHUTE} segundos: vale para o seu estudo, mas não conta no ranking nem na sequência.
            </p>
          )}
        </div>
      )}

      {/* Setas, como no TEC: voltar, (Responder ou Refazer) e avançar. A seta de avançar sem resposta é o
          "pular". Nada avança sozinho. No fluxo da página (não fixa no rodapé). */}
      <div className="flex items-center gap-3">
        <Button
          variante="contorno"
          onClick={onAnterior}
          disabled={!onAnterior || enviando}
          aria-label="Questão anterior"
          title="Questão anterior"
          className="h-12 w-14 shrink-0 px-0"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Button>
        {!resultado ? (
          <Button onClick={responder} disabled={!escolhida || enviando} className="h-12 flex-1 px-4">
            {enviando && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {enviando ? "Conferindo" : "Responder"}
          </Button>
        ) : (
          <Button variante="contorno" onClick={refazer} className="h-12 flex-1 px-4">
            <RotateCcw className="size-4" aria-hidden />
            Refazer
          </Button>
        )}
        <Button
          variante={resultado ? undefined : "contorno"}
          onClick={onProxima}
          disabled={!onProxima || enviando}
          aria-label={resultado ? "Próxima questão" : "Pular para a próxima questão"}
          title={resultado ? "Próxima questão" : "Pular"}
          className="h-12 w-14 shrink-0 px-0"
        >
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>

      {resultado && (
        <div className="space-y-5">
          {verComentario && resultado.comentario && (
            <ComentarioQuestao comentario={resultado.comentario} gabarito={resultado.gabarito} escolhida={escolhida} />
          )}
          <ReportarErro key={questao.id} tipo="questao" id={questao.id} />
        </div>
      )}
    </article>
  );
}
