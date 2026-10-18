"use client";

import { ArrowBigRight, ArrowRight, Check, ChevronRight, Folder, FolderOpen, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { MAX_AREAS } from "@/lib/filtros";
import { cn, formatarNumero } from "@/lib/utils";
import type { MateriaArvore } from "@/server/estudar";

type Props = {
  materias: MateriaArvore[];
  /** Para onde vai ao começar: /questoes ou /flashcards. */
  destino: string;
  unidade: string; // "questões" ou "cards"
  /** Matéria aberta ao chegar (links antigos com ?disciplina=). */
  abertaInicial?: number;
};

/** O que está marcado: nada (todas as matérias), uma matéria inteira ou algumas áreas dela. */
type Selecao = { disciplinaId: number; areas: number[] } | null;

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Escolha de matéria e áreas em árvore de pastas, como no filtro do TEC Concursos:
 * pasta amarela = matéria; seta azul = "todo o conteúdo"; seta verde = uma área.
 */
export function ArvoreEstudo({ materias, destino, unidade, abertaInicial }: Props) {
  const router = useRouter();
  const [abertas, setAbertas] = useState<Set<number>>(() => new Set(abertaInicial ? [abertaInicial] : []));
  const [selecao, setSelecao] = useState<Selecao>(null);
  const [busca, setBusca] = useState("");
  const [indo, iniciar] = useTransition();

  // Busca: mostra a matéria se o nome dela ou de alguma área bate; abre as que batem por área.
  const termo = normalizar(busca.trim());
  const visiveis = useMemo(() => {
    if (!termo) return materias.map((m) => ({ ...m, abertaPelaBusca: false }));
    return materias
      .map((m) => {
        const nomeBate = normalizar(m.nome).includes(termo);
        const areas = nomeBate ? m.areas : m.areas.filter((a) => normalizar(a.nome).includes(termo));
        return { ...m, areas, abertaPelaBusca: !nomeBate && areas.length > 0, visivel: nomeBate || areas.length > 0 };
      })
      .filter((m) => m.visivel);
  }, [materias, termo]);

  function alternarPasta(id: number) {
    setAbertas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  }

  function marcarTudo(disciplinaId: number) {
    setSelecao((s) => (s?.disciplinaId === disciplinaId && s.areas.length === 0 ? null : { disciplinaId, areas: [] }));
  }

  function marcarArea(disciplinaId: number, areaId: number) {
    setSelecao((s) => {
      // Área de outra matéria: recomeça a seleção nela (uma matéria por vez).
      const atuais = s?.disciplinaId === disciplinaId ? s.areas : [];
      const areas = atuais.includes(areaId) ? atuais.filter((a) => a !== areaId) : [...atuais, areaId].slice(0, MAX_AREAS);
      return areas.length ? { disciplinaId, areas } : null;
    });
  }

  // Resumo do que está marcado, para a barra de começar.
  const materiaSel = selecao ? materias.find((m) => m.id === selecao.disciplinaId) : undefined;
  const areasSel = materiaSel ? materiaSel.areas.filter((a) => selecao!.areas.includes(a.id)) : [];
  const resumo = !materiaSel
    ? { nome: "Todas as matérias", total: materias.reduce((s, m) => s + m.total, 0) }
    : areasSel.length === 0
      ? { nome: `Todo o conteúdo de ${materiaSel.nome}`, total: materiaSel.total }
      : {
          nome: areasSel.length === 1 ? `${materiaSel.nome} · ${areasSel[0]!.nome}` : `${materiaSel.nome} · ${areasSel.length} áreas`,
          total: areasSel.reduce((s, a) => s + a.total, 0),
        };

  function comecar() {
    const p = new URLSearchParams();
    if (selecao) {
      p.set("disciplina", String(selecao.disciplinaId));
      for (const a of selecao.areas) p.append("assunto", String(a));
    }
    iniciar(() => router.push(p.size ? `${destino}?${p}` : destino));
  }

  return (
    <div className="space-y-4">
      {/* Barra presa no topo: o que está marcado e o botão de começar, sem precisar rolar a árvore. */}
      <div className="sticky top-14 z-10 -mx-5 border-b border-borda bg-fundo px-5 py-3 md:top-16 md:mx-0 md:rounded-2xl md:border md:bg-superficie md:px-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="text-[11px] font-bold uppercase tracking-[.06em] text-suave">Selecionado</p>
            <p className="truncate text-sm font-extrabold">{resumo.nome}</p>
            <p className="text-xs tabular-nums text-suave">
              {formatarNumero(resumo.total)} {unidade}
            </p>
          </div>
          {selecao && (
            <button
              type="button"
              onClick={() => setSelecao(null)}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-suave hover:bg-camada hover:text-texto"
              aria-label="Limpar seleção"
              title="Limpar seleção"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
          <Button onClick={comecar} disabled={indo} className="shrink-0 px-5">
            {indo ? "Abrindo..." : "Começar"}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-borda bg-superficie">
        <label className="flex items-center gap-2 border-b border-borda px-4 py-3">
          <Search className="size-4 shrink-0 text-marca-clara" aria-hidden />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por nome"
            aria-label="Pesquisar matéria ou assunto por nome"
            className="min-w-0 flex-1 bg-transparent text-sm text-texto placeholder:text-marca-clara focus:outline-none"
          />
          {busca && (
            <button type="button" onClick={() => setBusca("")} className="text-suave hover:text-texto" aria-label="Limpar busca">
              <X className="size-4" aria-hidden />
            </button>
          )}
        </label>

        <ul className="py-1.5" role="tree" aria-label="Matérias e assuntos">
          {!termo && (
            <li role="treeitem" aria-selected={!selecao}>
              <Linha onClick={() => setSelecao(null)} marcada={!selecao} nivel={0}>
                <ArrowBigRight className="size-5 shrink-0 fill-marca text-marca" aria-hidden />
                <span className="min-w-0 flex-1 font-semibold">Misturar todas as matérias</span>
              </Linha>
            </li>
          )}

          {visiveis.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-suave">Nada encontrado com &quot;{busca}&quot;.</li>
          )}

          {visiveis.map((m) => {
            const aberta = abertas.has(m.id) || m.abertaPelaBusca;
            const PastaIcone = aberta ? FolderOpen : Folder;
            const tudoMarcado = selecao?.disciplinaId === m.id && selecao.areas.length === 0;
            return (
              <li key={m.id} role="treeitem" aria-expanded={aberta} aria-selected={selecao?.disciplinaId === m.id}>
                <Linha onClick={() => alternarPasta(m.id)} nivel={0}>
                  <ChevronRight
                    className={cn("size-4 shrink-0 text-suave transition-transform", aberta && "rotate-90")}
                    aria-hidden
                  />
                  <PastaIcone className="size-5 shrink-0 fill-destaque text-destaque" aria-hidden />
                  <span className="min-w-0 flex-1 font-semibold">{m.nome}</span>
                  <Contador n={m.total} />
                </Linha>

                {aberta && (
                  <ul role="group" className="relative">
                    <li role="treeitem" aria-selected={tudoMarcado}>
                      <Linha onClick={() => marcarTudo(m.id)} marcada={tudoMarcado} nivel={1}>
                        <ArrowBigRight className="size-5 shrink-0 fill-marca text-marca" aria-hidden />
                        <span className="min-w-0 flex-1">Todo o conteúdo de &quot;{m.nome}&quot;</span>
                        <Contador n={m.total} />
                      </Linha>
                    </li>
                    {m.areas.map((a) => {
                      const marcada = selecao?.disciplinaId === m.id && selecao.areas.includes(a.id);
                      return (
                        <li key={a.id} role="treeitem" aria-selected={marcada}>
                          <Linha onClick={() => marcarArea(m.id, a.id)} marcada={marcada} nivel={1}>
                            <ArrowBigRight className="size-5 shrink-0 fill-acerto text-acerto" aria-hidden />
                            <span className="min-w-0 flex-1">{a.nome}</span>
                            <Contador n={a.total} />
                          </Linha>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-center text-xs text-suave">
        Abra a pasta da matéria e toque em &quot;Todo o conteúdo&quot; ou marque uma ou mais áreas.
      </p>
    </div>
  );
}

function Linha({
  children,
  onClick,
  marcada = false,
  nivel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  marcada?: boolean;
  nivel: 0 | 1;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={nivel === 1 || marcada ? marcada : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 py-2.5 pr-4 text-left text-sm transition-colors hover:bg-camada",
        nivel === 0 ? "pl-3" : "relative pl-11 before:absolute before:inset-y-0 before:left-[1.35rem] before:border-l before:border-dotted before:border-borda-forte",
        marcada && "bg-marca-suave hover:bg-marca-suave",
      )}
    >
      {children}
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-md transition-colors",
          marcada ? "bg-marca text-sobre-marca" : "invisible",
        )}
        aria-hidden
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    </button>
  );
}

function Contador({ n }: { n: number }) {
  return <span className="shrink-0 text-xs tabular-nums text-suave">{formatarNumero(n)}</span>;
}
