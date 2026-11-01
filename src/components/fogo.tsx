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
