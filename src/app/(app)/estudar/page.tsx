import { BookOpenCheck, Check, ChevronRight, Layers } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarraConfirmar } from "@/components/estudar/barra-confirmar";
import { lerId } from "@/lib/filtros";
import { exigirUsuario } from "@/lib/sessao";
import { cn, formatarNumero } from "@/lib/utils";
import { detalharMateria, listarMaterias, totaisPorTipo, type TipoEstudo } from "@/server/estudar";

export const metadata: Metadata = { title: "Estudar" };

type Params = Promise<{ [chave: string]: string | string[] | undefined }>;

const TIPOS: Record<TipoEstudo, { rotulo: string; descricao: string; destino: string }> = {
  questoes: {
    rotulo: "Questões",
    descricao: "Múltipla escolha e certo ou errado, com gabarito e comentário.",
    destino: "/questoes",
  },
  flashcards: {
    rotulo: "Flashcards",
    descricao: "Revisão com repetição espaçada: o card volta na hora certa.",
    destino: "/flashcards",
  },
};

const classeOpcao =
  "flex items-center justify-between gap-4 rounded-2xl border border-borda bg-white/5 px-4 py-4 transition-colors hover:border-marca hover:bg-marca-suave sm:px-5";
const classeRadio =
  "flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-borda bg-white/5 px-4 py-3 text-sm font-bold transition-colors hover:bg-white/10 has-[:checked]:border-marca has-[:checked]:bg-marca-suave";

function Cabecalho({ passo, titulo, voltar }: { passo: string; titulo: string; voltar?: string }) {
  return (
    <div>
      <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">{passo}</p>
      <h1 className="mt-1 text-[28px] sm:text-[34px] font-extrabold leading-[1.1] tracking-[-.03em]">{titulo}</h1>
      {voltar && (
        <Link href={voltar} className="mt-3 inline-block text-sm font-bold text-marca-clara hover:underline">
          Voltar
        </Link>
      )}
    </div>
  );
}

function Total({ n, rotulo }: { n: number; rotulo: string }) {
  return (
    <span className="shrink-0 text-sm tabular-nums text-suave">
      {formatarNumero(n)} {rotulo}
    </span>
  );
}

export default async function PaginaEstudar({ searchParams }: { searchParams: Params }) {
  await exigirUsuario();
  const sp = await searchParams;
  const tipo = sp.tipo === "questoes" || sp.tipo === "flashcards" ? sp.tipo : undefined;
  const disciplinaId = lerId(typeof sp.disciplina === "string" ? sp.disciplina : undefined);

  // Passo 1: questões ou flashcards
  if (!tipo) {
    const totais = await totaisPorTipo();
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <Cabecalho passo="Passo 1 de 3" titulo="Como você quer estudar hoje?" />
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(TIPOS) as TipoEstudo[]).map((t) => {
            const Icone = t === "questoes" ? BookOpenCheck : Layers;
            return (
              <Link
                key={t}
                href={`/estudar?tipo=${t}`}
                className="group rounded-2xl border border-borda bg-white/5 p-5 transition-colors sm:p-6 hover:border-marca hover:bg-marca-suave"
              >
                <Icone className="size-7 text-marca-clara" aria-hidden />
                <p className="mt-4 text-xl font-extrabold">{TIPOS[t].rotulo}</p>
                <p className="mt-1 text-sm text-suave">{TIPOS[t].descricao}</p>
                <p className="mt-4 text-sm font-bold tabular-nums text-texto/75">
                  {formatarNumero(totais[t])} disponíveis
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  const unidade = tipo === "questoes" ? "questões" : "cards";

  // Passo 2: matéria
  if (!disciplinaId) {
    const materias = await listarMaterias(tipo);
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <Cabecalho passo={`Passo 2 de 3 · ${TIPOS[tipo].rotulo}`} titulo="Escolha a matéria" voltar="/estudar" />
        {materias.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-borda p-10 text-center text-sm text-suave">
            Ainda não há {unidade} cadastrados.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {materias.map((m) => (
              <Link key={m.id} href={`/estudar?tipo=${tipo}&disciplina=${m.id}`} className={classeOpcao}>
                <span className="min-w-0 font-extrabold">{m.nome}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <Total n={m.total} rotulo={unidade} />
                  <ChevronRight className="size-4 text-suave" aria-hidden />
                </span>
              </Link>
            ))}
            <Link href={TIPOS[tipo].destino} className={cn(classeOpcao, "sm:col-span-2")}>
              <span className="font-bold text-texto/75">Misturar todas as matérias</span>
              <ChevronRight className="size-4 text-suave" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Passo 3: áreas (opcional, uma ou várias). O nível não é escolhido: as questões vêm misturadas, como na prova.
  const materia = await detalharMateria(tipo, disciplinaId);
  if (!materia) notFound();
  const todasAsAreas = `Todas as áreas de ${materia.disciplina.nome}`;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Cabecalho
        passo={`Passo 3 de 3 · ${TIPOS[tipo].rotulo} · ${materia.disciplina.nome}`}
        titulo="Tudo da matéria ou só algumas áreas?"
        voltar={`/estudar?tipo=${tipo}`}
      />

      {/* Formulário GET: as áreas marcadas viram ?assunto=1&assunto=2. Nenhuma marcada = todas. */}
      <form action={TIPOS[tipo].destino} className="group/form space-y-6">
        <input type="hidden" name="disciplina" value={materia.disciplina.id} />
        <BarraConfirmar todas={{ nome: todasAsAreas, total: materia.total }} unidade={unidade} />

        <fieldset className="space-y-3">
          <legend className="mb-3 text-sm font-bold text-texto/75">Marque uma ou mais áreas</legend>
          {/* "Todas" limpa a seleção (reset nativo, funciona sem JavaScript). Fica marcada enquanto nada está. */}
          <button
            type="reset"
            className={cn(
              classeRadio,
              "w-full border-marca bg-marca-suave text-left group-has-[:checked]/form:border-borda group-has-[:checked]/form:bg-white/5",
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-marca group-has-[:checked]/form:bg-transparent group-has-[:checked]/form:ring-[1.5px] group-has-[:checked]/form:ring-white/30">
                <Check className="size-3.5 text-white group-has-[:checked]/form:opacity-0" strokeWidth={3} aria-hidden />
              </span>
              {todasAsAreas}
            </span>
            <Total n={materia.total} rotulo={unidade} />
          </button>
          <div className="grid gap-2 sm:grid-cols-2">
            {materia.areas.map((a) => (
              <label key={a.id} className={cn(classeRadio, "font-semibold")}>
                <span className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    name="assunto"
                    value={a.id}
                    data-nome={a.nome}
                    data-total={a.total}
                    className="peer sr-only"
                  />
                  <span className="grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] border-white/30 transition-colors peer-checked:border-marca peer-checked:bg-marca peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-marca [&_svg]:opacity-0 peer-checked:[&_svg]:opacity-100">
                    <Check className="size-3.5 text-white" strokeWidth={3} aria-hidden />
                  </span>
                  {a.nome}
                </span>
                <Total n={a.total} rotulo="" />
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </div>
  );
}
