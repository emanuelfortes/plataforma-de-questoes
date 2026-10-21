"use client";

import { ArrowBigRight, ArrowRight, Check, ChevronRight, Folder, FolderOpen, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CONFIG_FILTRO } from "@/components/questoes/icone-status";
import {
  DIFICULDADES_FILTRO,
  MAX_AREAS,
  ROTULO_DIFICULDADE_FILTRO,
  ROTULO_TIPO_QUESTAO,
  TIPOS_QUESTAO,
  type DificuldadeFiltro,
  type FiltroStatus,
  type TipoQuestao,
} from "@/lib/filtros";
import { cn, formatarNumero } from "@/lib/utils";
import type { ItemArvore, MateriaArvore } from "@/server/estudar";

type Props = {
  materias: MateriaArvore[];
  /** Para onde vai ao começar: /questoes ou /flashcards. */
  destino: string;
  unidade: string; // "questões" ou "cards"
  /** Matéria aberta ao chegar (links antigos com ?disciplina=). */
  abertaInicial?: number;
  /** Só nas questões: Opções de status (não resolvidas, acertei, errei...) junto da escolha do conteúdo. */
  comOpcoes?: boolean;
  /** Só aparece quando o banco tem questões de certo ou errado (contagem "q:ce"). */
  comTipoQuestao?: boolean;
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
export function ArvoreEstudo({ materias, destino, unidade, abertaInicial, comOpcoes = false, comTipoQuestao = false }: Props) {
  const router = useRouter();
  const [abertas, setAbertas] = useState<Set<number>>(() => new Set(abertaInicial ? [abertaInicial] : []));
  const [selecao, setSelecao] = useState<Selecao>(null);
  const [busca, setBusca] = useState("");
  // Opções (só questões). Nada marcado = sem filtro. Dificuldade aceita várias; tipo e resolução, uma.
  const [dificuldades, setDificuldades] = useState<DificuldadeFiltro[]>([]);
  const [tipoQuestao, setTipoQuestao] = useState<TipoQuestao | null>(null);
  const [status, setStatus] = useState<FiltroStatus>("todas");
  const [indo, iniciar] = useTransition();

  const [pastasAbertas, setPastasAbertas] = useState<Set<string>>(() => new Set());

  // Busca: mostra a matéria se o nome dela ou de alguma área bate; abre as matérias e pastas que batem por área.
  const termo = normalizar(busca.trim());
  const visiveis = useMemo(() => {
    if (!termo) return materias.map((m) => ({ ...m, abertaPelaBusca: false }));
    const bate = (nome: string) => normalizar(nome).includes(termo);
    const filtrar = (lista: ItemArvore[]): ItemArvore[] =>
      lista.flatMap((i): ItemArvore[] => {
        if (i.tipo === "area") return bate(i.area.nome) ? [i] : [];
        if (bate(i.nome)) return [i];
        const itens = filtrar(i.itens);
        return itens.length ? [{ ...i, itens }] : [];
      });
    return materias
      .map((m) => {
        const nomeBate = bate(m.nome);
        const itens = nomeBate ? m.itens : filtrar(m.itens);
        return { ...m, itens, abertaPelaBusca: !nomeBate && itens.length > 0, visivel: nomeBate || itens.length > 0 };
      })
      .filter((m) => m.visivel);
  }, [materias, termo]);

  function alternarSubpasta(chave: string) {
    setPastasAbertas((atual) => {
      const nova = new Set(atual);
      if (nova.has(chave)) nova.delete(chave);
      else nova.add(chave);
      return nova;
    });
  }

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

  // "Todo o conteúdo" de uma subpasta: marca todas as áreas dela (ou desmarca, se já estavam todas).
  function marcarPasta(disciplinaId: number, ids: number[]) {
    setSelecao((s) => {
      const atuais = s?.disciplinaId === disciplinaId ? s.areas : [];
      const todas = ids.every((id) => atuais.includes(id));
      const areas = todas ? atuais.filter((a) => !ids.includes(a)) : [...new Set([...atuais, ...ids])].slice(0, MAX_AREAS);
      return areas.length ? { disciplinaId, areas } : null;
    });
  }

  // Área solta ou pasta (com "Todo o conteúdo" e o que tem dentro), em qualquer nível.
  function desenharItem(disciplinaId: number, item: ItemArvore, nivel: number, caminho: string): React.ReactNode {
    const marcadas = selecao?.disciplinaId === disciplinaId ? selecao.areas : [];
    if (item.tipo === "area") {
      const a = item.area;
      const marcada = marcadas.includes(a.id);
      return (
        <li key={a.id} role="treeitem" aria-selected={marcada}>
          <Linha onClick={() => marcarArea(disciplinaId, a.id)} marcada={marcada} nivel={nivel}>
            <ArrowBigRight className="size-5 shrink-0 fill-acerto text-acerto" aria-hidden />
            <span className="min-w-0 flex-1">{a.nome}</span>
            <Contador n={a.total} />
          </Linha>
        </li>
      );
    }
    const chave = `${caminho}/${item.nome}`;
    const aberta = pastasAbertas.has(chave) || !!termo;
    const Icone = aberta ? FolderOpen : Folder;
    const ids = idsDoItem(item);
    const tudo = ids.every((id) => marcadas.includes(id));
    return (
      <li key={chave} role="treeitem" aria-expanded={aberta}>
        <Linha onClick={() => alternarSubpasta(chave)} nivel={nivel} pasta>
          <ChevronRight className={cn("size-4 shrink-0 text-suave transition-transform", aberta && "rotate-90")} aria-hidden />
          <Icone className="size-5 shrink-0 fill-destaque text-destaque" aria-hidden />
          <span className="min-w-0 flex-1">{item.nome}</span>
          <Contador n={item.total} />
        </Linha>
        {aberta && (
          <ul role="group">
            <li role="treeitem" aria-selected={tudo}>
              <Linha onClick={() => marcarPasta(disciplinaId, ids)} marcada={tudo} nivel={nivel + 1}>
                <ArrowBigRight className="size-5 shrink-0 fill-marca text-marca" aria-hidden />
                {/* O nome da pasta está logo acima: aqui só "Todo o conteúdo", para caber no celular. */}
                <span className="min-w-0 flex-1">Todo o conteúdo</span>
                <Contador n={item.total} />
              </Linha>
            </li>
            {item.itens.map((filho) => desenharItem(disciplinaId, filho, nivel + 1, chave))}
          </ul>
        )}
      </li>
    );
  }

  // Resumo do que está marcado, para a barra de começar.
  const materiaSel = selecao ? materias.find((m) => m.id === selecao.disciplinaId) : undefined;
  const areasSel = materiaSel ? materiaSel.areas.filter((a) => selecao!.areas.includes(a.id)) : [];
  const resumo = !materiaSel
    ? { nome: "Todas as matérias", total: materias.reduce((s, m) => s + m.total, 0) }
    : areasSel.length === 0
      ? { nome: `Todo o conteúdo de ${materiaSel.nome}`, total: materiaSel.total }
      : {
          nome:
            areasSel.length === 1
              ? `${materiaSel.nome} · ${areasSel[0]!.nome}`
              : `${materiaSel.nome} · ${pastaIgual(materiaSel.itens, selecao!.areas) ?? `${areasSel.length} áreas`}`,
          total: areasSel.reduce((s, a) => s + a.total, 0),
        };

  function comecar() {
    const p = new URLSearchParams();
    if (selecao) {
      p.set("disciplina", String(selecao.disciplinaId));
      for (const a of selecao.areas) p.append("assunto", String(a));
    }
    if (comOpcoes) {
      if (dificuldades.length < DIFICULDADES_FILTRO.length) for (const d of dificuldades) p.append("dificuldade", d);
      if (tipoQuestao) p.set("tipoq", tipoQuestao);
      if (status !== "todas") p.set("status", status);
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

      {comOpcoes && (
        <section aria-label="Opções" className="space-y-4 rounded-2xl border border-borda bg-superficie px-4 py-4">
          <GrupoOpcoes titulo="Dificuldade">
            {DIFICULDADES_FILTRO.map((d) => (
              <Opcao
                key={d}
                marcada={dificuldades.includes(d)}
                onClick={() => setDificuldades((a) => (a.includes(d) ? a.filter((x) => x !== d) : [...a, d]))}
              >
                {ROTULO_DIFICULDADE_FILTRO[d]}
              </Opcao>
            ))}
          </GrupoOpcoes>
          {comTipoQuestao && (
          <GrupoOpcoes titulo="Tipo de questão">
            {TIPOS_QUESTAO.map((t) => (
              <Opcao key={t} marcada={tipoQuestao === t} onClick={() => setTipoQuestao((a) => (a === t ? null : t))}>
                {ROTULO_TIPO_QUESTAO[t]}
              </Opcao>
            ))}
          </GrupoOpcoes>
          )}
          <GrupoOpcoes titulo="Resoluções e acertos">
            {(["resolvidas", "nao_resolvidas", "acertei", "errei"] as const).map((st) => {
              const { Icone, cor, rotulo } = CONFIG_FILTRO[st];
              return (
                <Opcao key={st} marcada={status === st} onClick={() => setStatus((a) => (a === st ? "todas" : st))}>
                  <Icone className={cn("size-4", status !== st && cor)} aria-hidden />
                  {rotulo}
                </Opcao>
              );
            })}
          </GrupoOpcoes>
        </section>
      )}

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
                    {m.itens.map((item) => desenharItem(m.id, item, 1, String(m.id)))}
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
  pasta = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  marcada?: boolean;
  nivel: number;
  /** Linha que só abre e fecha uma pasta (não marca nada). */
  pasta?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pasta ? undefined : nivel > 0 || marcada ? marcada : undefined}
      // Recuo de 1,25rem por nível (pastas dentro de pastas: Penal > Pessoa > Vida > Feminicídio).
      style={{ paddingLeft: `${0.75 + RECUO * nivel}rem` }}
      className={cn(
        "relative flex w-full items-center gap-2.5 py-2.5 pr-4 text-left text-sm transition-colors hover:bg-camada",
        marcada && "bg-marca-suave hover:bg-marca-suave",
      )}
    >
      {Array.from({ length: nivel }, (_, k) => (
        <span
          key={k}
          className="absolute inset-y-0 border-l border-dotted border-borda-forte"
          style={{ left: `${1.1 + RECUO * k}rem` }}
          aria-hidden
        />
      ))}
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

function GrupoOpcoes({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-[11px] font-bold uppercase tracking-[.06em] text-suave">{titulo}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Opcao({ marcada, onClick, children }: { marcada: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={marcada}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition-colors",
        marcada ? "border-marca bg-marca text-sobre-marca" : "border-borda bg-camada text-texto hover:border-marca",
      )}
    >
      {marcada && !Array.isArray(children) && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
      {children}
    </button>
  );
}

const RECUO = 1.25;

function idsDoItem(item: ItemArvore): number[] {
  return item.tipo === "area" ? [item.area.id] : item.itens.flatMap(idsDoItem);
}

/** Nome da pasta cujas áreas são exatamente as marcadas (para o resumo dizer "Crimes contra a Vida"). */
function pastaIgual(itens: ItemArvore[], marcadas: number[]): string | undefined {
  const alvo = new Set(marcadas);
  for (const i of itens) {
    if (i.tipo !== "pasta") continue;
    const ids = idsDoItem(i);
    if (ids.length === alvo.size && ids.every((id) => alvo.has(id))) return i.nome;
    const dentro = pastaIgual(i.itens, marcadas);
    if (dentro) return dentro;
  }
  return undefined;
}
