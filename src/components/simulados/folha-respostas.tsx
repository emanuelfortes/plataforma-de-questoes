"use client";

import { Play, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatarTempo } from "@/lib/simulados";
import { cn } from "@/lib/utils";
import { comecarSimulado, entregarSimulado, guardarMarcacoes } from "@/server/acoes-simulados";

// Cartão-resposta do simulado: o aluno faz a prova no PDF impresso e marca aqui, com o cronômetro correndo.
// As marcações vão para o servidor enquanto ele marca (e ficam no aparelho como reserva).
// Quando o tempo acaba, entrega sozinho com o que estiver marcado.

export function BotaoComecar({ id, duracaoMin }: { id: number; duracaoMin: number }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  if (!confirmar) {
    return (
      <Button tamanho="grande" className="w-full sm:w-auto sm:px-10" onClick={() => setConfirmar(true)}>
        <Play className="size-5" aria-hidden /> Dar o play
      </Button>
    );
  }
  return (
    <div className="space-y-3 rounded-xl border border-destaque/50 bg-destaque-suave p-4 text-sm">
      <p>
        O cronômetro de <strong>{formatarTempo(duracaoMin * 60)}</strong> começa agora e não pausa, como na prova. Você
        tem uma tentativa só. Está com a prova impressa e a caneta na mão?
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={enviando}
          onClick={() =>
            iniciar(async () => {
              const r = await comecarSimulado(id);
              if (!r.ok) setErro(r.erro);
              else router.refresh();
            })
          }
        >
          {enviando ? "Começando..." : "Começar agora"}
        </Button>
        <Button variante="fantasma" onClick={() => setConfirmar(false)}>
          Ainda não
        </Button>
      </div>
      {erro && <p className="font-bold text-erro">{erro}</p>}
    </div>
  );
}

export function FolhaRespostas({
  id,
  opcoes,
  restante,
  respostasIniciais,
}: {
  id: number;
  opcoes: string;
  /** Segundos que faltam, calculados no servidor. */
  restante: number;
  respostasIniciais: string[];
}) {
  const router = useRouter();
  const chave = `simulado-${id}`;
  const [respostas, setRespostas] = useState(respostasIniciais);
  const [segundos, setSegundos] = useState(restante);
  const [salvo, setSalvo] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const fim = useRef(Date.now() + restante * 1000);
  const entregue = useRef(false);
  const atual = useRef(respostas);
  atual.current = respostas;

  // Reserva no aparelho: se a internet cair, as marcações voltam ao recarregar.
  useEffect(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(chave) ?? "null") as string[] | null;
      if (guardado?.length === respostasIniciais.length && guardado.some((r, i) => r !== respostasIniciais[i])) setRespostas(guardado);
    } catch {}
  }, [chave, respostasIniciais]);

  const entregar = useCallback(() => {
    if (entregue.current) return;
    entregue.current = true;
    iniciar(async () => {
      const r = await entregarSimulado(id, atual.current);
      if (!r.ok) {
        entregue.current = false;
        setErro(r.erro);
        return;
      }
      try {
        localStorage.removeItem(chave);
      } catch {}
      router.refresh();
    });
  }, [chave, id, router]);

  // Cronômetro pelo relógio (não conta tiques: aba em segundo plano não atrasa).
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.round((fim.current - Date.now()) / 1000);
      setSegundos(s);
      if (s <= 0) entregar();
    }, 1000);
    return () => clearInterval(t);
  }, [entregar]);

  // Salva no servidor 1,5 s depois da última marcação.
  useEffect(() => {
    if (respostas === respostasIniciais) return;
    setSalvo(false);
    try {
      localStorage.setItem(chave, JSON.stringify(respostas));
    } catch {}
    const t = setTimeout(async () => {
      if (await guardarMarcacoes(id, respostas).catch(() => false)) setSalvo(true);
    }, 1500);
    return () => clearTimeout(t);
  }, [chave, id, respostas, respostasIniciais]);

  const marcar = (i: number, letra: string) => setRespostas((r) => r.map((x, k) => (k === i ? (x === letra ? "" : letra) : x)));
  const emBranco = respostas.filter((r) => !r).length;
  const pouco = segundos <= 10 * 60;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "sticky top-16 z-10 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 backdrop-blur",
          pouco ? "border-erro/50 bg-erro-suave" : "border-borda bg-superficie/95",
        )}
      >
        <span className={cn("flex items-center gap-2 text-2xl font-extrabold tabular-nums", pouco && "text-erro")} role="timer" aria-live="off">
          <Timer className="size-6" aria-hidden /> {formatarTempo(segundos)}
        </span>
        <span className="text-right text-xs text-suave">
          {respostas.length - emBranco} de {respostas.length} marcadas
          <br />
          {salvo ? "Salvo" : "Salvando..."}
        </span>
      </div>

      <ol className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
        {respostas.map((r, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg px-2 py-1 odd:bg-camada">
            <span className="w-8 text-right text-sm font-extrabold tabular-nums text-suave">{String(i + 1).padStart(2, "0")}</span>
            <div className="flex gap-1.5" role="radiogroup" aria-label={`Questão ${i + 1}`}>
              {[...opcoes].map((letra) => (
                <button
                  key={letra}
                  type="button"
                  role="radio"
                  aria-checked={r === letra}
                  onClick={() => marcar(i, letra)}
                  className={cn(
                    "grid size-9 touch-manipulation place-items-center rounded-full border-2 text-sm font-extrabold transition-colors",
                    r === letra ? "border-marca bg-marca text-sobre-marca" : "border-borda-forte text-suave hover:border-marca",
                  )}
                >
                  {letra}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {confirmar ? (
        <div className="space-y-3 rounded-xl border border-destaque/50 bg-destaque-suave p-4 text-sm">
          <p>
            Entregar agora? {emBranco ? `Você deixou ${emBranco} em branco. ` : ""}Depois de entregar não dá para mudar.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={enviando} onClick={entregar}>
              {enviando ? "Entregando..." : "Sim, entregar"}
            </Button>
            <Button variante="fantasma" onClick={() => setConfirmar(false)}>
              Voltar
            </Button>
          </div>
        </div>
      ) : (
        <Button tamanho="grande" className="w-full sm:w-auto sm:px-10" onClick={() => setConfirmar(true)} disabled={enviando}>
          Entregar o simulado
        </Button>
      )}
      {erro && <p className="text-sm font-bold text-erro">{erro}</p>}
    </div>
  );
}
