"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn, formatarNumero } from "@/lib/utils";
import { FILTROS_STATUS, type FiltroStatus } from "@/lib/filtros";
import { CONFIG_FILTRO } from "./icone-status";

// Matéria, área, dificuldade e tipo são escolhidos na tela Estudar; aqui fica só o status do aluno.
type Props = {
  contagens: Record<FiltroStatus, number>;
  atual: { status: FiltroStatus };
  /** Com dificuldade ou tipo escolhidos, os totais pré-calculados não valem: mostra só os nomes. */
  semNumeros?: boolean;
};

// Cor do pontinho de cada status (substitui o ícone; mais limpo no fundo escuro).
const PONTO: Record<FiltroStatus, string> = {
  todas: "bg-destaque",
  nao_resolvidas: "bg-suave/60",
  resolvidas: "bg-marca",
  acertei: "bg-acerto",
  errei: "bg-erro",
};

export function Filtros({ contagens, atual, semNumeros = false }: Props) {
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
      {/* No celular, uma linha que rola para o lado (sangra até a borda da tela). */}
      <div
        role="radiogroup"
        aria-label="Status"
        className="sem-barra -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
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
                "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-xs font-bold transition-colors",
                ativo ? "border-marca bg-marca text-sobre-marca" : "border-borda bg-superficie text-texto/75 hover:bg-camada-forte",
              )}
            >
              <span className={cn("size-1.5 rounded-full", PONTO[status])} aria-hidden />
              {CONFIG_FILTRO[status].rotulo}
              {!semNumeros && <span className="tabular-nums opacity-60">{formatarNumero(contagens[status])}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
