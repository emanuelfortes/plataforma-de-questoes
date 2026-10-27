import { Star } from "lucide-react";
import type { CSSProperties } from "react";
import { Insignia } from "@/components/ranking/insignia";
import { patenteDe } from "@/lib/patentes";
import { cn } from "@/lib/utils";

export type Colocado = {
  usuarioId: string;
  nome: string;
  /** Questões diferentes resolvidas (define a patente). */
  resolvidas: number;
  /** Número principal (questões ou %) e a legenda embaixo. */
  grande: string;
  pequeno: string;
};

type Props = {
  /** Os três primeiros, na ordem (1º, 2º, 3º). Pode vir com menos de três. */
  primeiros: Colocado[];
  usuarioId: string;
};

// Cada colocação tem a sua cor de medalha, tamanho de chama, escudo e altura de pedestal.
const ESTILO = {
  1: {
    chama: { "--cor-chama": "var(--color-fogo)", "--cor-nucleo": "var(--color-ouro)", "--tamanho-chama": 1.35 },
    moldura: "bg-ouro",
    escudo: "w-20 h-24 text-3xl",
    numero: "text-ouro",
    pedestal: "h-24 from-ouro/30 border-ouro/60 text-ouro",
  },
  2: {
    chama: { "--cor-chama": "var(--color-marca)", "--cor-nucleo": "var(--color-prata)", "--tamanho-chama": 1 },
    moldura: "bg-prata",
    escudo: "w-16 h-[76px] text-2xl",
    numero: "text-prata",
    pedestal: "h-16 from-prata/25 border-prata/50 text-prata",
  },
  3: {
    chama: { "--cor-chama": "var(--color-fogo)", "--cor-nucleo": "var(--color-bronze)", "--tamanho-chama": 0.9 },
    moldura: "bg-bronze",
    escudo: "w-14 h-[66px] text-xl",
    numero: "text-bronze",
    pedestal: "h-11 from-bronze/25 border-bronze/50 text-bronze",
  },
} as const;

/** Pódio dos três primeiros: 2º à esquerda, 1º no centro (mais alto, com estrelas e faíscas), 3º à direita. */
export function Podio({ primeiros, usuarioId }: Props) {
  const ordemNaTela = [2, 1, 3] as const;
  return (
    <section aria-label="Pódio" className="fundo-tatico relative overflow-hidden rounded-2xl border border-borda px-3 pt-16">
      <p className="absolute left-4 top-3 font-estencil text-[11px] uppercase tracking-[.18em] text-oliva">Quadro de honra</p>
      <ol className="grid grid-cols-3 items-end gap-2">
        {ordemNaTela.map((posicao) => (
          <Lugar key={posicao} posicao={posicao} colocado={primeiros[posicao - 1]} eu={primeiros[posicao - 1]?.usuarioId === usuarioId} />
        ))}
      </ol>
    </section>
  );
}

function Lugar({ posicao, colocado, eu }: { posicao: 1 | 2 | 3; colocado?: Colocado; eu: boolean }) {
  const e = ESTILO[posicao];
  const patente = colocado ? patenteDe(colocado.resolvidas).atual : null;
  return (
    <li className="flex min-w-0 flex-col items-center" aria-label={`${posicao}º lugar`}>
      {/* Escudo com a chama atrás */}
      <div className="relative mb-2 grid place-items-center">
        {colocado && <span className="chama" style={e.chama as CSSProperties} aria-hidden />}
        {posicao === 1 && colocado && (
          <>
            {[
              { left: "20%", atraso: "0s", desvio: "-8px" },
              { left: "50%", atraso: "0.8s", desvio: "4px" },
              { left: "78%", atraso: "1.6s", desvio: "10px" },
            ].map((f) => (
              <span
                key={f.left}
                className="faisca"
                style={{ left: f.left, animationDelay: f.atraso, "--desvio": f.desvio } as CSSProperties}
                aria-hidden
              />
            ))}
            {/* Três estrelas de general no lugar da coroa */}
            <span className="absolute -top-7 flex items-end gap-0.5 text-ouro drop-shadow" aria-hidden>
              <Star className="size-4 fill-current" />
              <Star className="size-5 fill-current" />
              <Star className="size-4 fill-current" />
            </span>
          </>
        )}
        {colocado ? (
          // Moldura metálica (escudo maior) e o miolo escuro com a inicial.
          <span className={cn("escudo relative grid place-items-center p-[3px]", e.moldura, e.escudo)}>
            <span className="escudo grid size-full place-items-center bg-fundo">
              <span className={cn("-mt-1 font-estencil", e.numero)}>{colocado.nome.charAt(0).toUpperCase()}</span>
            </span>
          </span>
        ) : (
          <span className="escudo grid h-[66px] w-14 place-items-center bg-camada-forte font-estencil text-xl text-suave">?</span>
        )}
      </div>

      {/* Patente, nome e número */}
      {patente && (
        <p className="mb-0.5 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.08em] text-oliva">
          <Insignia patente={patente} className="h-2.5" />
          {patente.nome}
        </p>
      )}
      <p className={cn("w-full truncate text-center font-extrabold", posicao === 1 ? "text-base" : "text-sm")}>
        {colocado ? colocado.nome : "Vago"}
      </p>
      {eu && <p className="text-[11px] font-extrabold text-marca-clara">(você)</p>}
      {colocado && (
        <p className="mb-2 text-center leading-tight">
          <span className={cn("block font-estencil tabular-nums", posicao === 1 ? "text-xl" : "text-lg", e.numero)}>{colocado.grande}</span>
          <span className="block text-[11px] text-suave">{colocado.pequeno}</span>
        </p>
      )}

      {/* Pedestal: chapa com faixa de atenção no topo e número em estêncil */}
      <div
        className={cn(
          "relative grid w-full place-items-center overflow-hidden rounded-t-md border border-b-0 bg-linear-to-b to-transparent",
          e.pedestal,
          !colocado && "mt-2",
        )}
      >
        <span className="listras absolute inset-x-0 top-0 h-1.5 opacity-50" aria-hidden />
        <span className={cn("font-estencil tabular-nums", posicao === 1 ? "text-4xl" : "text-2xl")}>
          {posicao}
          <span className="align-super text-[.5em]">º</span>
        </span>
      </div>
    </li>
  );
}
