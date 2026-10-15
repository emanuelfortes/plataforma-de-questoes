import { BookOpenCheck, ChevronRight, Layers } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  "flex items-center justify-between gap-4 rounded-2xl border border-borda bg-white/5 px-5 py-4 transition-colors hover:border-marca hover:bg-marca-suave";
const classeRadio =
  "flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-borda bg-white/5 px-4 py-3 text-sm font-bold transition-colors hover:bg-white/10 has-[:checked]:border-marca has-[:checked]:bg-marca-suave";

function Cabecalho({ passo, titulo, voltar }: { passo: string; titulo: string; voltar?: string }) {
  return (
    <div>
      <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">{passo}</p>
      <h1 className="mt-1 text-[34px] font-extrabold leading-[1.1] tracking-[-.03em]">{titulo}</h1>
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
                className="group rounded-2xl border border-borda bg-white/5 p-6 transition-colors hover:border-marca hover:bg-marca-suave"
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
                <span className="font-extrabold">{m.nome}</span>
                <span className="flex items-center gap-2">
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

  // Passo 3: área (opcional). O nível não é escolhido: as questões vêm misturadas, como na prova.
  // Formulário GET: funciona sem JavaScript.
  const materia = await detalharMateria(tipo, disciplinaId);
  if (!materia) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Cabecalho
        passo={`Passo 3 de 3 · ${TIPOS[tipo].rotulo} · ${materia.disciplina.nome}`}
        titulo="Tudo da matéria ou uma área específica?"
        voltar={`/estudar?tipo=${tipo}`}
      />

      <form action={TIPOS[tipo].destino} className="space-y-8">
        <input type="hidden" name="disciplina" value={materia.disciplina.id} />

        <fieldset className="space-y-3">
          <legend className="mb-3 text-sm font-bold text-texto/75">Área</legend>
          <label className={classeRadio}>
            <span className="flex items-center gap-3">
              <input type="radio" name="assunto" value="" defaultChecked className="accent-marca" />
              Todas as áreas de {materia.disciplina.nome}
            </span>
            <Total n={materia.total} rotulo={unidade} />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {materia.areas.map((a) => (
              <label key={a.id} className={cn(classeRadio, "font-semibold")}>
                <span className="flex items-center gap-3">
                  <input type="radio" name="assunto" value={a.id} className="accent-marca" />
                  {a.nome}
                </span>
                <Total n={a.total} rotulo="" />
              </label>
            ))}
          </div>
        </fieldset>


        <Button type="submit" tamanho="grande" className="w-full px-9 shadow-[0_8px_24px_rgba(47,107,255,.4)] sm:w-auto">
          Começar
        </Button>
      </form>
    </div>
  );
}
