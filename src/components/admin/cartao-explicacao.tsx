"use client";

import { Check, Save, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Explicacao } from "@/lib/explicacao";
import { decidirExplicacao } from "@/server/acoes-vade-mecum";

type Props = { lei: string; artigo: string; inicial: Explicacao; conferir: string | null };

const classeCampo =
  "w-full rounded-lg border border-borda bg-camada px-3 py-2 text-sm leading-relaxed text-texto focus-visible:outline-2 focus-visible:outline-marca";

/** Explicação editável: o professor corrige o que precisar e aprova (o aluno passa a ver) ou rejeita. */
export function CartaoExplicacao({ lei, artigo, inicial, conferir }: Props) {
  const [sentido, setSentido] = useState(inicial.sentido);
  const [pontos, setPontos] = useState(inicial.pontos.join("\n"));
  const [exemplo, setExemplo] = useState(inicial.exemplo);
  const [pegadinha, setPegadinha] = useState(inicial.pegadinha ?? "");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, iniciar] = useTransition();

  function decidir(acao: "aprovar" | "salvar" | "rejeitar") {
    setAviso(null);
    iniciar(async () => {
      const campos = {
        sentido,
        pontos: pontos
          .split("\n")
          .map((p) => p.replace(/^[-•]\s*/, "").trim())
          .filter(Boolean),
        exemplo,
        pegadinha: pegadinha.trim() || null,
      };
      const r = await decidirExplicacao({ lei, artigo }, campos, acao);
      const feito = acao === "aprovar" ? "Aprovada: o aluno já vê." : acao === "rejeitar" ? "Rejeitada." : "Salvo.";
      setAviso(r.ok ? { ok: true, texto: feito } : { ok: false, texto: r.erro });
    });
  }

  return (
    <div className="space-y-3">
      {conferir && (
        <p className="rounded-lg border border-destaque/40 bg-destaque-suave px-3 py-2 text-sm text-destaque">
          <strong>Conferir:</strong> {conferir}
        </p>
      )}
      <Campo rotulo="O que o artigo quer dizer">
        <textarea value={sentido} onChange={(e) => setSentido(e.target.value)} rows={4} className={classeCampo} />
      </Campo>
      <Campo rotulo="O que mais cai (um ponto por linha)">
        <textarea value={pontos} onChange={(e) => setPontos(e.target.value)} rows={6} className={classeCampo} />
      </Campo>
      <Campo rotulo="Exemplo">
        <textarea value={exemplo} onChange={(e) => setExemplo(e.target.value)} rows={3} className={classeCampo} />
      </Campo>
      <Campo rotulo="Pegadinha da banca (pode ficar vazio)">
        <textarea value={pegadinha} onChange={(e) => setPegadinha(e.target.value)} rows={2} className={classeCampo} />
      </Campo>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => decidir("aprovar")} disabled={enviando}>
          <Check className="size-4" aria-hidden /> Aprovar
        </Button>
        <Button variante="contorno" onClick={() => decidir("salvar")} disabled={enviando}>
          <Save className="size-4" aria-hidden /> Salvar sem aprovar
        </Button>
        <Button variante="contorno" onClick={() => decidir("rejeitar")} disabled={enviando} className="text-erro">
          <X className="size-4" aria-hidden /> Rejeitar
        </Button>
        {aviso && <span className={aviso.ok ? "text-sm font-bold text-acerto" : "text-sm font-bold text-erro"}>{aviso.texto}</span>}
      </div>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold text-suave">{rotulo}</span>
      {children}
    </label>
  );
}
