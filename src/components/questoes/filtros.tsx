"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn, formatarNumero } from "@/lib/utils";
import { FILTROS_STATUS, type FiltroStatus } from "@/lib/filtros";
import { CONFIG_FILTRO } from "./icone-status";

type Props = {
  disciplinas: { id: number; nome: string }[];
  assuntos: { id: number; nome: string }[];
  contagens: Record<FiltroStatus, number>;
  atual: { disciplina?: number; assunto?: number; status: FiltroStatus };
};

const classeSelect =
  "h-10 w-full rounded-lg border border-borda bg-superficie px-3 text-sm focus-visible:outline-2 focus-visible:outline-marca";

export function Filtros({ disciplinas, assuntos, contagens, atual }: Props) {
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
    novo.delete("cursor"); // qualquer filtro novo volta para a primeira página
    iniciar(() => router.push(`${caminho}?${novo.toString()}`));
  }

  return (
    <section
      aria-label="Filtros"
      className={cn("space-y-4 transition-opacity", pendente && "opacity-60")}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Disciplina</span>
          <select
            className={classeSelect}
            value={atual.disciplina ?? ""}
            onChange={(e) => aplicar({ disciplina: e.target.value || undefined, assunto: undefined })}
          >
            <option value="">Todas as disciplinas</option>
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Assunto</span>
          <select
            className={classeSelect}
            value={atual.assunto ?? ""}
            disabled={!atual.disciplina}
            onChange={(e) => aplicar({ assunto: e.target.value || undefined })}
          >
            <option value="">{atual.disciplina ? "Todos os assuntos" : "Escolha uma disciplina"}</option>
            {assuntos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-2">
        {FILTROS_STATUS.map((status) => {
          const { rotulo, Icone, cor } = CONFIG_FILTRO[status];
          const ativo = atual.status === status;
          return (
            <button
              key={status}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => aplicar({ status: status === "todas" ? undefined : status })}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors",
                ativo
                  ? "border-marca bg-marca-suave font-medium text-marca-forte"
                  : "border-borda bg-superficie hover:bg-fundo",
              )}
            >
              <Icone className={cn("size-4", cor)} aria-hidden />
              {rotulo}
              <span className="tabular-nums text-xs text-suave">
                {formatarNumero(contagens[status])}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
