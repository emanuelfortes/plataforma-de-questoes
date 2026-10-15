"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn, formatarNumero } from "@/lib/utils";
import { FILTROS_STATUS, type FiltroStatus } from "@/lib/filtros";
import { CONFIG_FILTRO } from "./icone-status";

// Matéria, área e nível são escolhidos na tela Estudar; aqui fica só o status do aluno.
type Props = {
  contagens: Record<FiltroStatus, number>;
  atual: { status: FiltroStatus };
};

// Cor do pontinho de cada status (substitui o ícone; mais limpo no fundo escuro).
const PONTO: Record<FiltroStatus, string> = {
  todas: "bg-destaque",
  nao_resolvidas: "bg-white/40",
  resolvidas: "bg-marca",
  acertei: "bg-acerto",
  errei: "bg-erro",
};

export function Filtros({ contagens, atual }: Props) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();

  function aplicar(mudancas: Record<string, string | undefined>) {
    const novo = new URLSearchParams(params.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) novo.set(chave, valor);
      else novo.delete(chave);
    }
    // Trocar o status recomeça a sequência (mantém o mesmo ponto de partida sorteado).
    for (const chave of ["cursor", "volta", "pagina"]) novo.delete(chave);
    iniciar(() => router.push(`${caminho}?${novo.toString()}`));
  }

  return (
    <section aria-label="Filtros" className={cn("space-y-4 transition-opacity", pendente && "opacity-60")}>
      <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-2">
        {FILTROS_STATUS.map((status) => {
          const ativo = atual.status === status;
          return (
            <button
              key={status}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => aplicar({ status: status === "todas" ? undefined : status })}
              className={cn(
                "inline-flex h-[34px] items-center gap-2 rounded-full border px-3 text-xs font-bold transition-colors",
                ativo ? "border-marca bg-marca text-white" : "border-borda bg-white/5 text-texto/75 hover:bg-white/10",
              )}
            >
              <span className={cn("size-1.5 rounded-full", PONTO[status])} aria-hidden />
              {CONFIG_FILTRO[status].rotulo}
              <span className="tabular-nums opacity-60">{formatarNumero(contagens[status])}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
