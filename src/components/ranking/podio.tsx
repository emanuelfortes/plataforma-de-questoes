import { Crown, Flame } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type Colocado = {
  usuarioId: string;
  nome: string;
  /** Número principal (questões ou %) e a legenda embaixo. */
  grande: string;
  pequeno: string;
};

type Props = {
  /** Os três primeiros, na ordem (1º, 2º, 3º). Pode vir com menos de três. */
  primeiros: Colocado[];
  usuarioId: string;
};

// Cada colocação tem a sua cor de fogo, tamanho de chama, avatar e altura de pedestal.
const ESTILO = {
  1: {
    chama: { "--cor-chama": "var(--color-fogo)", "--cor-nucleo": "var(--color-ouro)", "--tamanho-chama": 1.35 },
    anel: "ring-ouro",
    avatar: "size-20 text-2xl bg-ouro",
    numero: "text-ouro",
    pedestal: "h-24 from-ouro/35 border-ouro/60",
  },
  2: {
    chama: { "--cor-chama": "var(--color-marca)", "--cor-nucleo": "var(--color-prata)", "--tamanho-chama": 1 },
    anel: "ring-prata",
    avatar: "size-16 text-xl bg-prata",
    numero: "text-prata",
    pedestal: "h-16 from-prata/30 border-prata/50",
  },
  3: {
    chama: { "--cor-chama": "var(--color-fogo)", "--cor-nucleo": "var(--color-bronze)", "--tamanho-chama": 0.9 },
    anel: "ring-bronze",
    avatar: "size-14 text-lg bg-bronze",
    numero: "text-bronze",
    pedestal: "h-11 from-bronze/30 border-bronze/50",
  },
} as const;

/** Pódio dos três primeiros: 2º à esquerda, 1º no centro (mais alto, com coroa e faíscas), 3º à direita. */
export function Podio({ primeiros, usuarioId }: Props) {
  const ordemNaTela = [2, 1, 3] as const;
  return (
    <section aria-label="Pódio" className="overflow-hidden rounded-2xl border border-borda bg-superficie px-3 pt-14">
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
  return (
    <li className={cn("flex min-w-0 flex-col items-center", posicao === 1 && "order-none")} aria-label={`${posicao}º lugar`}>
      {/* Avatar com a chama atrás */}
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
            <Crown className="absolute -top-7 size-7 fill-ouro text-ouro drop-shadow" aria-hidden />
          </>
        )}
        <span
          className={cn(
            "relative grid place-items-center rounded-full font-extrabold text-sobre-medalha ring-4 ring-offset-2 ring-offset-superficie",
            colocado ? [e.avatar, e.anel] : "size-14 bg-camada-forte text-suave ring-borda",
          )}
        >
          {colocado ? colocado.nome.charAt(0).toUpperCase() : "?"}
        </span>
      </div>

      {/* Nome e número */}
      <p className={cn("w-full truncate text-center font-extrabold", posicao === 1 ? "text-base" : "text-sm")}>
        {colocado ? colocado.nome : "Vago"}
        {posicao === 1 && colocado && <Flame className="ml-1 inline size-4 fill-fogo text-fogo align-[-2px]" aria-hidden />}
      </p>
      {eu && <p className="text-[11px] font-extrabold text-marca-clara">(você)</p>}
      {colocado && (
        <p className="mb-2 text-center leading-tight">
          <span className={cn("block font-extrabold tabular-nums", posicao === 1 ? "text-lg" : "text-base", e.numero)}>{colocado.grande}</span>
          <span className="block text-[11px] text-suave">{colocado.pequeno}</span>
        </p>
      )}

      {/* Pedestal */}
      <div
        className={cn(
          "grid w-full place-items-center rounded-t-xl border border-b-0 bg-linear-to-b to-transparent",
          e.pedestal,
          !colocado && "mt-2",
        )}
      >
        <span className={cn("font-extrabold tabular-nums", posicao === 1 ? "text-4xl" : "text-2xl", e.numero)}>{posicao}</span>
      </div>
    </li>
  );
}
