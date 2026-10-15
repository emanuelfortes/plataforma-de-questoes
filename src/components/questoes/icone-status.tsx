import { Circle, CircleCheck, CircleDot, CircleX, ListChecks } from "lucide-react";
import type { FiltroStatus, StatusAluno } from "@/lib/filtros";
import { cn } from "@/lib/utils";

// Os 4 ícones de status + "todas". Um único lugar para trocar ícone, cor e rótulo.
export const CONFIG_FILTRO: Record<
  FiltroStatus,
  { rotulo: string; Icone: typeof Circle; cor: string }
> = {
  todas: { rotulo: "Todas", Icone: ListChecks, cor: "text-suave" },
  nao_resolvidas: { rotulo: "Não resolvidas", Icone: Circle, cor: "text-suave" },
  resolvidas: { rotulo: "Resolvidas", Icone: CircleDot, cor: "text-marca" },
  acertei: { rotulo: "Acertei", Icone: CircleCheck, cor: "text-acerto" },
  errei: { rotulo: "Errei", Icone: CircleX, cor: "text-erro" },
};

const POR_STATUS: Record<StatusAluno, FiltroStatus> = {
  nao_resolvida: "nao_resolvidas",
  acertou: "acertei",
  errou: "errei",
};

export function IconeStatus({ status, className }: { status: StatusAluno; className?: string }) {
  const { Icone, cor, rotulo } = CONFIG_FILTRO[POR_STATUS[status]];
  const titulo = status === "nao_resolvida" ? "Não resolvida" : status === "acertou" ? "Você acertou" : "Você errou";
  return (
    <Icone className={cn("size-4", cor, className)} aria-label={titulo ?? rotulo} role="img" />
  );
}
