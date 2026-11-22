import { ArrowRight, BookMarked, BookOpenCheck, FileClock, Layers, Lock, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArvoreEstudo } from "@/components/estudar/arvore-estudo";
import { InstalarApp } from "@/components/instalar-app";
import { COR_AREA, type ChaveCor } from "@/lib/cores-area";
import { DESLOCAMENTO_MS } from "@/lib/datas";
import { lerDificuldades, lerFiltroStatus, lerId, lerIds, lerTipoQuestao } from "@/lib/filtros";
import { exigirUsuario } from "@/lib/sessao";
import { cn, formatarNumero } from "@/lib/utils";
import { temAcessoCompleto, temElite } from "@/server/assinatura";
import { listarProximosSimulados } from "@/server/simulados";
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

type Cartao = { chave: ChaveCor; rotulo: string; descricao: string; Icone: LucideIcon; href: string; rodape: string; selo?: string };

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "domingo, 22/11 às 8h" no horário de Brasília. */
function quandoLibera(data: Date) {
  const d = new Date(data.getTime() + DESLOCAMENTO_MS);
  const dois = (n: number) => String(n).padStart(2, "0");
  const minutos = d.getUTCMinutes();
  return `${DIAS[d.getUTCDay()]}, ${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)} às ${d.getUTCHours()}h${minutos ? dois(minutos) : ""}`;
}

/** Cartão de entrada colorido: faixa no topo, brilho suave no canto e selo do ícone na cor da parte. */
function CartaoEntrada({ chave, rotulo, descricao, Icone, href, rodape, selo }: Cartao) {
  const cor = COR_AREA[chave];
  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-borda bg-superficie p-5 outline-none transition duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 motion-reduce:transform-none sm:p-6",
        cor.borda,
      )}
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", cor.barra)} />
      <span
        aria-hidden
        className={cn("pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100", cor.fundo)}
      />
      <div className="relative flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid size-12 place-items-center rounded-xl transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transform-none",
            cor.fundo,
            cor.texto,
          )}
        >
          <Icone className="size-6" aria-hidden />
        </span>
        {selo && (
          <span className="inline-flex items-center gap-1 rounded-full bg-destaque-suave px-2.5 py-1 text-[11px] font-extrabold text-destaque">
            <Lock className="size-3" aria-hidden /> {selo}
          </span>
        )}
      </div>
      <p className="relative mt-4 text-xl font-extrabold">{rotulo}</p>
      <p className="relative mt-1 text-sm text-suave">{descricao}</p>
      <p className={cn("relative mt-4 inline-flex items-center gap-1.5 text-sm font-bold tabular-nums", cor.texto)}>
        {rodape}
        <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden />
      </p>
    </Link>
  );
}

export default async function PaginaEstudar({ searchParams }: { searchParams: Params }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const tipo = sp.tipo === "questoes" || sp.tipo === "flashcards" ? sp.tipo : undefined;

  // Passo 1: por onde estudar. Cada parte tem a sua cor (src/lib/cores-area.ts).
  if (!tipo) {
    const [totais, acessoCompleto, elite, proximos] = await Promise.all([
      totaisPorTipo(),
      temAcessoCompleto(usuario),
      temElite(usuario),
      listarProximosSimulados(),
    ]);
    const proximo = proximos[0];
    const cartoes: Cartao[] = [
      {
        chave: "questoes",
        rotulo: TIPOS.questoes.rotulo,
        descricao: TIPOS.questoes.descricao,
        Icone: BookOpenCheck,
        href: "/estudar?tipo=questoes",
        rodape: `${formatarNumero(totais.questoes)} disponíveis`,
      },
      {
        chave: "flashcards",
        rotulo: TIPOS.flashcards.rotulo,
        descricao: TIPOS.flashcards.descricao,
        Icone: Layers,
        // Flashcards são só de assinantes: o grátis vê o cartão com cadeado e cai na tela de prévia.
        href: acessoCompleto ? "/estudar?tipo=flashcards" : "/flashcards",
        rodape: `${formatarNumero(totais.flashcards)} disponíveis`,
        selo: acessoCompleto ? undefined : "Assinantes",
      },
      {
        chave: "simulados",
        rotulo: "Simulados",
        descricao: "Prova inteira no modelo do edital, com cronômetro, nota e ranking.",
        Icone: FileClock,
        href: "/simulados",
        rodape: proximo ? `Próximo: ${quandoLibera(proximo.liberadoEm)}` : "Ver os simulados",
        selo: elite ? undefined : "Tropa de Elite",
      },
      {
        chave: "vade",
        rotulo: "Vade Mecum",
        descricao: "A lei seca em leitura guiada, com as palavras que a banca cobra.",
        Icone: BookMarked,
        href: "/vade-mecum",
        rodape: "Abrir as leis",
        selo: acessoCompleto ? undefined : "Assinantes",
      },
    ];
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <Cabecalho passo="Estudar" titulo="Como você quer estudar hoje?" />
        <div className="grid gap-4 sm:grid-cols-2">
          {cartoes.map((c) => (
            <CartaoEntrada key={c.chave} {...c} />
          ))}
        </div>
        <InstalarApp />
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
