"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatarNumero } from "@/lib/utils";

type Props = {
  todas: { nome: string; total: number };
  unidade: string; // "questões" ou "cards"
};

type Resumo = { nome: string; total: number };

/**
 * Barra presa no topo (abaixo do cabeçalho do app) com o que está marcado e o botão de começar no canto,
 * como na seleção de uma galeria de fotos: o aluno vai marcando áreas e confirma sem rolar a lista.
 * Lê as caixas marcadas do próprio formulário (data-nome e data-total); sem JavaScript, o botão envia igual.
 */
export function BarraConfirmar({ todas, unidade }: Props) {
  const refBotao = useRef<HTMLButtonElement>(null);
  const [resumo, setResumo] = useState<Resumo>(todas);

  useEffect(() => {
    const form = refBotao.current?.form;
    if (!form) return;
    const atualizar = () => {
      const marcadas = [...form.querySelectorAll<HTMLInputElement>("input[name=assunto]:checked")];
      if (marcadas.length === 0) return setResumo(todas);
      const nomes = marcadas.map((m) => m.dataset.nome ?? "");
      setResumo({
        nome: marcadas.length === 1 ? nomes[0]! : `${marcadas.length} áreas: ${nomes.join(", ")}`,
        total: marcadas.reduce((soma, m) => soma + Number(m.dataset.total ?? 0), 0),
      });
    };
    // O reset (botão "Todas") avisa antes de limpar as caixas: lê depois.
    const aoLimpar = () => setTimeout(atualizar);
    atualizar(); // o navegador pode restaurar as marcações ao voltar para a página
    form.addEventListener("change", atualizar);
    form.addEventListener("reset", aoLimpar);
    return () => {
      form.removeEventListener("change", atualizar);
      form.removeEventListener("reset", aoLimpar);
    };
  }, [todas]);

  return (
    // top = altura do cabeçalho do app (h-14 no celular, h-16 no computador).
    <div className="sticky top-14 z-10 -mx-5 border-b border-borda bg-fundo px-5 py-3 md:top-16 md:mx-0 md:rounded-2xl md:border md:px-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-[11px] font-bold uppercase tracking-[.06em] text-suave">Selecionado</p>
          <p className="truncate text-sm font-extrabold">{resumo.nome}</p>
          <p className="text-xs tabular-nums text-suave">
            {formatarNumero(resumo.total)} {unidade}
          </p>
        </div>
        <Button ref={refBotao} type="submit" className="shrink-0 px-5">
          Começar
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
