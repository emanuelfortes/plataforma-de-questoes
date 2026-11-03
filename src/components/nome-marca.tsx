import { NOME_PRODUTO, NOME_PROFESSOR } from "@/lib/marca";
import { cn } from "@/lib/utils";

/** Nome da plataforma em duas linhas: o professor em destaque e o QProva na cor da marca. */
export function NomeMarca({ className }: { className?: string }) {
  return (
    <span className={cn("flex min-w-0 flex-col leading-none", className)}>
      <span className="truncate text-[13px] font-extrabold uppercase tracking-[.02em]">{NOME_PROFESSOR}</span>
      <span className="mt-0.5 text-[17px] font-extrabold tracking-[-.01em] text-marca-clara">{NOME_PRODUTO}</span>
    </span>
  );
}
