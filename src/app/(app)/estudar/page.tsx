import { BookOpenCheck, Layers } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArvoreEstudo } from "@/components/estudar/arvore-estudo";
import { lerDificuldades, lerFiltroStatus, lerId, lerIds, lerTipoQuestao } from "@/lib/filtros";
import { exigirUsuario } from "@/lib/sessao";
import { formatarNumero } from "@/lib/utils";
import { arvoreDeEstudo, temCertoErrado, totaisPorTipo, type TipoEstudo } from "@/server/estudar";

export const metadata: Metadata = { title: "Estudar" };

type Params = Promise<{ [chave: string]: string | string[] | undefined }>;

const TIPOS: Record<TipoEstudo, { rotulo: string; descricao: string; destino: string; filtro: string }> = {
  questoes: {
    rotulo: "Questões",
    descricao: "Múltipla escolha e certo ou errado, com gabarito e comentário.",
    destino: "/questoes",
    filtro: "Filtrar questões",
  },
  flashcards: {
    rotulo: "Flashcards",
    descricao: "Revisão com repetição espaçada: o card volta na hora certa.",
    destino: "/flashcards",
    filtro: "Filtrar flashcards",
  },
};

function Cabecalho({ passo, titulo, voltar }: { passo: string; titulo: string; voltar?: string }) {
  return (
    <div>
      <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">{passo}</p>
      <h1 className="mt-1 text-[28px] font-extrabold leading-[1.1] tracking-[-.03em] sm:text-[34px]">{titulo}</h1>
      {voltar && (
        <Link href={voltar} className="mt-3 inline-block text-sm font-bold text-marca-clara hover:underline">
          Voltar
        </Link>
      )}
    </div>
  );
}

export default async function PaginaEstudar({ searchParams }: { searchParams: Params }) {
  await exigirUsuario();
  const sp = await searchParams;
  const tipo = sp.tipo === "questoes" || sp.tipo === "flashcards" ? sp.tipo : undefined;

  // Passo 1: questões ou flashcards
  if (!tipo) {
    const totais = await totaisPorTipo();
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <Cabecalho passo="Passo 1 de 2" titulo="Como você quer estudar hoje?" />
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(TIPOS) as TipoEstudo[]).map((t) => {
            const Icone = t === "questoes" ? BookOpenCheck : Layers;
            return (
              <Link
                key={t}
                href={`/estudar?tipo=${t}`}
                className="group rounded-2xl border border-borda bg-superficie p-5 transition-colors hover:border-marca hover:bg-marca-suave sm:p-6"
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

  // Passo 2: matéria e áreas, em árvore de pastas (estilo TEC). O nível não é escolhido:
  // as questões vêm misturadas, como na prova.
  const [materias, comCertoErrado] = await Promise.all([
    arvoreDeEstudo(tipo),
    tipo === "questoes" ? temCertoErrado() : false,
  ]);
  const unidade = tipo === "questoes" ? "questões" : "cards";
  const abertaInicial = lerId(typeof sp.disciplina === "string" ? sp.disciplina : undefined);
  // "Editar" na tela de questões volta para cá com os filtros aplicados na URL: a tela abre já marcada.
  const inicial = {
    disciplinaId: abertaInicial,
    areas: abertaInicial ? lerIds(sp.assunto) : [],
    dificuldades: lerDificuldades(sp.dificuldade),
    tipo: lerTipoQuestao(typeof sp.tipoq === "string" ? sp.tipoq : undefined),
    status: lerFiltroStatus(typeof sp.status === "string" ? sp.status : undefined),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Cabecalho passo={`Passo 2 de 2 · ${TIPOS[tipo].rotulo}`} titulo={TIPOS[tipo].filtro} voltar="/estudar" />
      {materias.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borda p-10 text-center text-sm text-suave">
          Ainda não há {unidade} cadastrados.
        </p>
      ) : (
        <ArvoreEstudo
          materias={materias}
          destino={TIPOS[tipo].destino}
          unidade={unidade}
          abertaInicial={abertaInicial}
          inicial={inicial}
          comOpcoes={tipo === "questoes"}
          comTipoQuestao={comCertoErrado}
        />
      )}
    </div>
  );
}
