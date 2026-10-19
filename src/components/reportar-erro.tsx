"use client";

import { Flag } from "lucide-react";
import { useState, useTransition } from "react";
import { classeCampo } from "@/components/campo-senha";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { reportarErro } from "@/server/acoes";

/** Link discreto "Reportar erro": o item sai do ar e vai para a revisão do dono. */
export function ReportarErro({ tipo, id }: { tipo: "questao" | "flashcard"; id: number }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();

  if (mensagem?.ok) return <p className="text-xs font-semibold text-suave">{mensagem.texto}</p>;
  if (!aberto)
    return (
      <button type="button" onClick={() => setAberto(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-suave hover:text-texto">
        <Flag className="size-3.5" aria-hidden /> Reportar erro
      </button>
    );
  return (
    <div className="space-y-2">
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder={tipo === "questao" ? "Qual é o erro? (gabarito, enunciado, comentário...)" : "Qual é o erro neste card?"}
        className={cn(classeCampo, "h-auto py-2 text-sm")}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          tamanho="pequeno"
          variante="contorno"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              const r = await reportarErro(tipo, id, motivo);
              setMensagem(r.ok ? { ok: true, texto: "Obrigado! Vamos revisar. Enquanto isso, este item saiu do ar." } : { ok: false, texto: r.erro });
            })
          }
        >
          Enviar
        </Button>
        <Button tamanho="pequeno" variante="fantasma" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
        {mensagem && !mensagem.ok && <span className="text-xs font-bold text-erro">{mensagem.texto}</span>}
      </div>
    </div>
  );
}
