"use client";

import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { classeCampo } from "@/components/campo-senha";
import { Button } from "@/components/ui/button";
import { montarPrompt, type MateriaExistente, type PedidoPrompt } from "@/lib/prompt-ia";
import { cn } from "@/lib/utils";

const ESTILOS: { valor: PedidoPrompt["estilo"]; rotulo: string }[] = [
  { valor: "multipla", rotulo: "Múltipla escolha (A a E)" },
  { valor: "certo_errado", rotulo: "Certo ou errado" },
  { valor: "misturar", rotulo: "Misturar os dois" },
];

function CampoNumero({ rotulo, valor, mudar }: { rotulo: string; valor: number; mudar: (n: number) => void }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-bold text-texto/75">{rotulo}</span>
      <input
        type="number"
        min={0}
        max={40}
        value={valor}
        onChange={(e) => mudar(Math.max(0, Math.min(40, Number(e.target.value) || 0)))}
        className={cn(classeCampo, "h-10")}
      />
    </label>
  );
}

/** O prompt serve para qualquer matéria: a IA identifica matéria e áreas pelo PDF. */
export function GeradorPrompt({ existentes }: { existentes: MateriaExistente[] }) {
  const [faceis, setFaceis] = useState(10);
  const [medias, setMedias] = useState(10);
  const [dificeis, setDificeis] = useState(10);
  const [qtdFlashcards, setQtdFlashcards] = useState(10);
  const [estilo, setEstilo] = useState<PedidoPrompt["estilo"]>("multipla");
  const [pontos, setPontos] = useState("");
  const [comExistentes, setComExistentes] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const temExistentes = existentes.some((m) => m.areas.length);
  const prompt = useMemo(
    () =>
      montarPrompt({
        faceis,
        medias,
        dificeis,
        flashcards: qtdFlashcards,
        estilo,
        pontosJaCobertos: pontos,
        existentes: comExistentes ? existentes : undefined,
      }),
    [faceis, medias, dificeis, qtdFlashcards, estilo, pontos, comExistentes, existentes],
  );

  async function copiar() {
    await navigator.clipboard.writeText(prompt);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-suave">
        Serve para PDF de qualquer matéria: a IA lê o conteúdo, identifica a matéria e os assuntos e cria as
        questões já organizadas.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CampoNumero rotulo="Fáceis" valor={faceis} mudar={setFaceis} />
        <CampoNumero rotulo="Médias" valor={medias} mudar={setMedias} />
        <CampoNumero rotulo="Difíceis" valor={dificeis} mudar={setDificeis} />
        <CampoNumero rotulo="Flashcards" valor={qtdFlashcards} mudar={setQtdFlashcards} />
      </div>
      <p className="-mt-2 text-xs text-suave">
        Até umas 30 questões por pedido. Acima disso a IA tende a repetir. Para mais, peça outro lote.
      </p>

      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1.5 font-bold text-texto/75">Formato das questões</legend>
        <div className="flex flex-wrap gap-2">
          {ESTILOS.map((e) => (
            <label
              key={e.valor}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-borda bg-white/5 px-3.5 py-2.5 font-bold has-[:checked]:border-marca has-[:checked]:bg-marca-suave"
            >
              <input
                type="radio"
                name="estilo"
                checked={estilo === e.valor}
                onChange={() => setEstilo(e.valor)}
                className="accent-marca"
              />
              {e.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      {temExistentes && (
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={comExistentes}
            onChange={(e) => setComExistentes(e.target.checked)}
            className="mt-0.5 accent-marca"
          />
          <span>
            <span className="font-bold">Mostrar à IA as matérias e áreas que já existem</span>
            <span className="block text-xs text-suave">
              Não limita nada: só faz a IA usar o mesmo nome quando o PDF tratar de um tema que já existe.
            </span>
          </span>
        </label>
      )}

      <label className="block space-y-1.5 text-sm">
        <span className="font-bold text-texto/75">Pontos já cobertos (opcional)</span>
        <textarea
          value={pontos}
          onChange={(e) => setPontos(e.target.value)}
          rows={3}
          placeholder="Ao gerar outro lote do mesmo PDF, cole aqui a lista de pontos que a conferência mostrou."
          className={cn(classeCampo, "h-auto py-2.5 text-sm")}
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-texto/75">Prompt pronto</span>
          <Button type="button" onClick={copiar} tamanho="pequeno">
            {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copiado ? "Copiado" : "Copiar prompt"}
          </Button>
        </div>
        <textarea
          readOnly
          value={prompt}
          rows={10}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(classeCampo, "h-auto py-2.5 font-mono text-xs leading-relaxed")}
        />
      </div>
    </div>
  );
}
