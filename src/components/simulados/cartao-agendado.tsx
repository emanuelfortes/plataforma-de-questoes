"use client";

import { Lock, Unlock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

// Simulado agendado: uma chapa de metal (com rebites, como no ranking) que esquenta de baixo para cima até a hora
// da liberação e explode quando o cronômetro zera. O estilo está em globals.css (.chapa e vizinhos).
//
// Fases pelo tempo que falta: frio (> 1 h), morno (1 h a 10 min), quente (10 min a 1 min), critico (último minuto)
// e explodiu. Depois da explosão a página recarrega os dados e o simulado entra na lista como disponível.
// "ensaio" (só o dono, por ?ensaio=<segundos>): conta a partir de agora e não recarrega, para ver o efeito.

type Fase = "frio" | "morno" | "quente" | "critico" | "explodiu";

function faseDe(restante: number): Fase {
  if (restante <= 0) return "explodiu";
  if (restante <= 60) return "critico";
  if (restante <= 600) return "quente";
  if (restante <= 3600) return "morno";
  return "frio";
}

/** 0 (fria) a 1 (no limite), subindo mais rápido perto do fim. */
function calorDe(restante: number) {
  if (restante > 3600) return 0;
  if (restante > 600) return 0.4 * (1 - (restante - 600) / 3000);
  if (restante > 60) return 0.4 + 0.4 * (1 - (restante - 60) / 540);
  return 0.8 + 0.2 * (1 - Math.max(0, restante) / 60);
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

// Posições fixas (nada de sorteio na renderização): fagulhas, labaredas, estilhaços e faíscas.
const FAGULHAS = Array.from({ length: 14 }, (_, i) => ({
  x: `${(i * 37 + 11) % 96}%`,
  atraso: `${((i * 0.43) % 2.6).toFixed(2)}s`,
  dur: `${(2.1 + ((i * 0.37) % 1.4)).toFixed(2)}s`,
  deriva: `${((i % 2 ? 1 : -1) * (6 + ((i * 7) % 22)))}px`,
  tam: `${2 + (i % 3)}px`,
}));
const LABAREDAS = Array.from({ length: 7 }, (_, i) => ({
  alt: `${62 + ((i * 29) % 38)}%`,
  dur: `${(0.55 + ((i * 0.17) % 0.5)).toFixed(2)}s`,
  atraso: `${(-(i * 0.21) % 0.9).toFixed(2)}s`,
}));
const ESTILHACOS = Array.from({ length: 12 }, (_, i) => {
  const ang = (i / 12) * Math.PI * 2 + 0.3;
  const dist = 140 + ((i * 53) % 120);
  return {
    x: `${15 + ((i * 41) % 70)}%`,
    y: `${20 + ((i * 29) % 60)}%`,
    l: `${14 + ((i * 13) % 26)}px`,
    a: `${10 + ((i * 7) % 18)}px`,
    dx: `${Math.round(Math.cos(ang) * dist)}px`,
    dy: `${Math.round(Math.sin(ang) * dist - 40)}px`,
    giro: `${(i % 2 ? 1 : -1) * (180 + ((i * 47) % 360))}deg`,
  };
});
const FAISCAS = Array.from({ length: 20 }, (_, i) => {
  const graus = (i / 20) * 360 + ((i * 13) % 9);
  const rad = (graus * Math.PI) / 180;
  const dist = 90 + ((i * 31) % 110);
  // A faísca aponta "para baixo" girada por --ang; o deslocamento segue a mesma direção.
  return { ang: `${graus}deg`, dx: `${Math.round(-Math.sin(rad) * dist)}px`, dy: `${Math.round(Math.cos(rad) * dist)}px` };
});

const ROTULO_FASE: Record<Fase, string> = {
  frio: "Em breve",
  morno: "Esquentando",
  quente: "Menos de 10 minutos",
  critico: "Último minuto",
  explodiu: "Liberado",
};

export function CartaoAgendado({
  titulo,
  concurso,
  questoes,
  duracaoMin,
  liberaEm,
  liberaTexto,
  elite,
  ensaio,
}: {
  titulo: string;
  concurso: string;
  questoes: number;
  duracaoMin: number;
  /** ISO da liberação. */
  liberaEm: string;
  /** "09/11, 20:20", já no fuso de Brasília (vem do servidor). */
  liberaTexto: string;
  elite: boolean;
  /** Segundos do ensaio do dono (o alvo passa a ser agora + ensaio). */
  ensaio?: number;
}) {
  const router = useRouter();
  const [alvo, setAlvo] = useState(() => new Date(liberaEm).getTime());
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => {
    if (ensaio) setAlvo(Date.now() + ensaio * 1000);
    setAgora(Date.now());
    const timer = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(timer);
  }, [ensaio]);

  const restante = agora === null ? null : Math.max(0, Math.ceil((alvo - agora) / 1000));
  const fase: Fase = restante === null ? "frio" : faseDe(restante);
  const calor = restante === null ? 0 : calorDe(restante);

  // Explodiu: deixa a animação acontecer e então recarrega os dados (o simulado entra como disponível).
  useEffect(() => {
    if (fase !== "explodiu" || ensaio) return;
    const t = setTimeout(() => router.refresh(), 2600);
    return () => clearTimeout(t);
  }, [fase, ensaio, router]);

  const dias = restante === null ? 0 : Math.floor(restante / 86400);
  const unidades: [string, string][] =
    restante === null
      ? [
          ["--", "h"],
          ["--", "min"],
          ["--", "s"],
        ]
      : [
          ...(dias ? ([[String(dias), dias === 1 ? "dia" : "dias"]] as [string, string][]) : []),
          [doisDigitos(Math.floor((restante % 86400) / 3600)), "h"],
          [doisDigitos(Math.floor((restante % 3600) / 60)), "min"],
          [doisDigitos(restante % 60), "s"],
        ];

  const fagulhas = fase === "morno" ? 5 : fase === "quente" ? 10 : fase === "critico" ? 14 : 0;
  const amp = fase === "critico" && restante !== null ? (0.4 + 2.6 * (1 - restante / 60)).toFixed(2) : "0";
  const rachar = fase === "critico" && restante !== null && restante <= 10 ? (10 - restante + 1) / 10 : 0;
  const explodiu = fase === "explodiu";

  return (
    <div
      className={cn(
        "chapa rounded-2xl p-4 pt-5",
        fase === "critico" && "chapa-critico chapa-tremendo",
        explodiu && "explodindo",
      )}
      style={{ "--calor": calor, "--amp": `${amp}px`, "--rachar": rachar } as CSSProperties}
    >
      {/* Calor: fagulhas e labaredas atrás do conteúdo. */}
      {FAGULHAS.slice(0, explodiu ? 0 : fagulhas).map((f, i) => (
        <span
          key={i}
          className="fagulha"
          aria-hidden
          style={{ "--x": f.x, "--atraso": f.atraso, "--dur": f.dur, "--deriva": f.deriva, "--tam": f.tam } as CSSProperties}
        />
      ))}
      {(fase === "quente" || fase === "critico") && (
        <div className="labaredas" aria-hidden>
          {LABAREDAS.map((l, i) => (
            <span key={i} className="labareda" style={{ "--alt": l.alt, "--dur": l.dur, "--atraso": l.atraso } as CSSProperties} />
          ))}
        </div>
      )}
      {rachar > 0 && !explodiu && (
        <svg className="rachaduras" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path pathLength={1} d="M50 58 L41 50 L44 41 L33 30 L36 18 L27 6" />
          <path pathLength={1} d="M50 58 L60 52 L58 40 L71 33 L69 21 L82 12" />
          <path pathLength={1} d="M50 58 L47 70 L55 79 L50 92" />
          <path pathLength={1} d="M50 58 L36 64 L24 61 L12 70" />
          <path pathLength={1} d="M50 58 L64 66 L77 63 L90 74" />
        </svg>
      )}

      {/* A chapa: some na explosão. */}
      <div className={cn("space-y-3", explodiu && "chapa-some")}>
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-camada" aria-hidden>
            <Lock className="chapa-cadeado size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-[.08em] text-destaque">
              {ROTULO_FASE[fase]} · {concurso}
            </p>
            <p className="font-extrabold">{titulo}</p>
            <p className="text-xs text-suave">
              {questoes} questões, {duracaoMin} min. Libera em {liberaTexto}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5" role="timer" aria-label="Tempo até a liberação">
            {unidades.map(([valor, unidade]) => (
              <span key={unidade} className="chapa-digito min-w-12 rounded-lg px-2 py-1 text-center">
                <span
                  key={fase === "critico" && unidade === "s" ? valor : unidade}
                  className={cn("chapa-digito-valor block text-lg font-extrabold tabular-nums leading-tight", fase === "critico" && unidade === "s" && "chapa-pulso")}
                >
                  {valor}
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-[.06em] text-suave">{unidade}</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-suave">
            {elite ? "Quando o cronômetro zerar, o PDF libera aqui." : "Exclusivo da Tropa de Elite: assine para fazer este simulado."}
          </p>
        </div>
      </div>

      {/* Explosão e o que aparece depois dela. */}
      {explodiu && (
        <>
          <span className="explosao-clarao" aria-hidden />
          <span className="explosao-onda" aria-hidden />
          {ESTILHACOS.map((e, i) => (
            <span
              key={`e${i}`}
              className="estilhaco-chapa"
              aria-hidden
              style={{ "--x": e.x, "--y": e.y, "--l": e.l, "--a": e.a, "--dx": e.dx, "--dy": e.dy, "--giro": e.giro } as CSSProperties}
            />
          ))}
          {FAISCAS.map((f, i) => (
            <span key={`f${i}`} className="faisca-explosao" aria-hidden style={{ "--ang": f.ang, "--dx": f.dx, "--dy": f.dy } as CSSProperties} />
          ))}
          <div className="liberado-surge absolute inset-0 z-[4] flex items-center gap-4 p-4" role="status">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-acerto text-sobre-marca" aria-hidden>
              <Unlock className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[.08em] text-acerto">Liberado · {concurso}</p>
              <p className="font-extrabold">{titulo}</p>
              <p className="text-xs text-suave">{ensaio ? "Ensaio: no ar, a página destrava aqui." : "Abrindo o simulado..."}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
