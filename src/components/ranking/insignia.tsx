import { cn } from "@/lib/utils";
import type { Patente } from "@/lib/patentes";

const ESTRELA = "M5 0.6l1.3 2.9 3.1.3-2.3 2.1.7 3.1L5 7.4 2.2 9l.7-3.1L.6 3.8l3.1-.3z";

/** Insígnia da patente em SVG (cor = currentColor): barra do recruta, divisas das praças e estrelas dos oficiais. */
export function Insignia({ patente, className }: { patente: Patente; className?: string }) {
  const { tipo, quantidade } = patente.insignia;
  if (tipo === "estrela") {
    const largura = quantidade * 11 - 1;
    return (
      <svg viewBox={`0 0 ${largura} 10`} className={cn("h-3 w-auto", className)} fill="currentColor" aria-hidden>
        {Array.from({ length: quantidade }, (_, i) => (
          <path key={i} d={ESTRELA} transform={`translate(${i * 11} 0)`} />
        ))}
      </svg>
    );
  }
  if (tipo === "barra") {
    return (
      <svg viewBox="0 0 14 14" className={cn("h-3.5 w-auto", className)} fill="currentColor" aria-hidden>
        <rect x="1" y="5.5" width="12" height="3" rx="0.5" />
      </svg>
    );
  }
  // Divisas: setas empilhadas apontando para cima.
  const altura = 4 + quantidade * 4;
  return (
    <svg viewBox={`0 0 14 ${altura}`} className={cn("h-3.5 w-auto", className)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="miter" aria-hidden>
      {Array.from({ length: quantidade }, (_, i) => (
        <path key={i} d={`M1.5 ${6 + i * 4}L7 ${1.5 + i * 4}l5.5 ${4.5}`} />
      ))}
    </svg>
  );
}
