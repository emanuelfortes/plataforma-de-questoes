import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Chama animada (CSS puro, classes .fogo em globals.css). Mede em `em`: o tamanho segue o text-* de quem usa,
 * como um ícone. `intenso` deixa a chama mais rápida e com mais brilho (sequências longas).
 */
export function Fogo({ className, intenso }: { className?: string; intenso?: boolean }) {
  return (
    <span className={cn("fogo", intenso && "fogo-intenso", className)} aria-hidden>
      <span className="fogo-lingua fogo-fora" />
      <span className="fogo-lingua fogo-meio" />
      <span className="fogo-lingua fogo-nucleo" />
    </span>
  );
}

/**
 * Labaredas subindo do pé de um bloco (o pai precisa de `relative overflow-hidden`). Partículas com
 * posição, atraso e tamanho fixos por índice (nada de Math.random: a mesma tela em todo render).
 */
export function Incendio({ forca = 1 }: { forca?: 1 | 2 }) {
  const quantas = forca === 2 ? 44 : 30;
  return (
    <div className="incendio" style={{ "--altura-fogo": forca === 2 ? "8.5rem" : "6rem" } as CSSProperties} aria-hidden>
      {Array.from({ length: quantas }, (_, i) => {
        const x = ((i * 37) % 100) + ((i * 7) % 5) - 2;
        return (
          <span
            key={i}
            className="particula-fogo"
            style={
              {
                "--x": `${x}%`,
                "--atraso": `${-((i * 0.29) % 1.6).toFixed(2)}s`,
                "--duracao": `${(1.1 + ((i * 0.17) % 0.8)).toFixed(2)}s`,
                "--tamanho": `${1.6 + ((i * 0.6) % 1.6)}rem`,
                "--deriva": `${((i % 5) - 2) * 6}px`,
              } as CSSProperties
            }
          />
        );
      })}
      {Array.from({ length: forca === 2 ? 10 : 6 }, (_, i) => (
        <span
          key={`f${i}`}
          className="faisca"
          style={{ left: `${8 + ((i * 29) % 84)}%`, bottom: "10%", animationDelay: `${(i * 0.37) % 2.4}s`, "--desvio": `${((i % 3) - 1) * 14}px` } as CSSProperties}
        />
      ))}
    </div>
  );
}
