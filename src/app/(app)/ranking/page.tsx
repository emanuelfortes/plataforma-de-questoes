import { Crosshair, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Podio } from "@/components/ranking/podio";
import { exigirUsuario } from "@/lib/sessao";
import { cn, formatarNumero } from "@/lib/utils";
import { MINIMO_MIRA, obterRanking, TAMANHO_RANKING, type LinhaRanking, type TipoRanking } from "@/server/ranking";

export const metadata: Metadata = { title: "Ranking" };

type Params = Promise<{ [chave: string]: string | string[] | undefined }>;

const ABAS: Record<TipoRanking, { rotulo: string; Icone: typeof Zap; descricao: string }> = {
  fuzil: {
    rotulo: "Fuzil de questões",
    Icone: Zap,
    descricao: "Quem resolveu mais questões diferentes. Refazer a mesma questão não conta.",
  },
  mira: {
    rotulo: "Bom de Mira",
    Icone: Crosshair,
    descricao: `Quem mais acerta de primeira, entre quem já resolveu pelo menos ${MINIMO_MIRA} questões.`,
  },
};

export default async function PaginaRanking({ searchParams }: { searchParams: Params }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const tipo: TipoRanking = sp.tipo === "mira" ? "mira" : "fuzil";
  const { lista, participantes, eu } = await obterRanking(tipo, usuario.id);
  const valor = (l: { resolvidas: number; acertos: number; percentual: number }) =>
    tipo === "fuzil"
      ? { grande: formatarNumero(l.resolvidas), pequeno: "questões" }
      : { grande: `${l.percentual}%`, pequeno: `${formatarNumero(l.acertos)} de ${formatarNumero(l.resolvidas)}` };
  const estouNaLista = lista.some((l) => l.usuarioId === usuario.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">Ranking</p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-[1.1] tracking-[-.03em] sm:text-[34px]">Quem está na frente</h1>
      </div>

      {/* Abas */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-borda bg-superficie p-1.5" role="tablist">
        {(Object.keys(ABAS) as TipoRanking[]).map((t) => {
          const { rotulo, Icone } = ABAS[t];
          const ativa = t === tipo;
          return (
            <Link
              key={t}
              href={t === "fuzil" ? "/ranking" : "/ranking?tipo=mira"}
              role="tab"
              aria-selected={ativa}
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition-colors",
                ativa ? "bg-marca text-sobre-marca" : "text-suave hover:bg-camada hover:text-texto",
              )}
            >
              <Icone className="size-4" aria-hidden />
              {rotulo}
            </Link>
          );
        })}
      </div>
      <p className="-mt-2 text-sm text-suave">{ABAS[tipo].descricao}</p>

      {/* Sua posição */}
      <section aria-label="Sua posição" className="rounded-2xl border border-marca/40 bg-marca-suave p-4">
        <p className="text-[11px] font-bold uppercase tracking-[.06em] text-marca-clara">Sua posição</p>
        {eu.posicao ? (
          <div className="mt-1 flex items-end justify-between gap-3">
            <p className="text-3xl font-extrabold tabular-nums">
              {eu.posicao}º <span className="text-sm font-bold text-suave">de {formatarNumero(participantes)}</span>
            </p>
            <p className="text-right">
              <span className="block text-xl font-extrabold tabular-nums">{valor(eu).grande}</span>
              <span className="text-xs text-suave">{valor(eu).pequeno}</span>
            </p>
          </div>
        ) : tipo === "mira" && eu.resolvidas > 0 ? (
          <p className="mt-1 text-sm">
            Resolva mais <strong>{eu.faltamParaMira}</strong> {eu.faltamParaMira === 1 ? "questão" : "questões"} para entrar no
            Bom de Mira (você tem {eu.resolvidas} de {MINIMO_MIRA}).
          </p>
        ) : (
          <p className="mt-1 text-sm">
            Você ainda não entrou no ranking.{" "}
            <Link href="/estudar?tipo=questoes" className="font-bold text-marca-clara hover:underline">
              Resolva a primeira questão
            </Link>
            .
          </p>
        )}
      </section>

      {/* Lista */}
      {lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borda p-8 text-center text-sm text-suave">
          {tipo === "mira"
            ? `Ninguém chegou às ${MINIMO_MIRA} questões ainda. Seja o primeiro.`
            : "Ninguém resolveu questões ainda. Seja o primeiro."}
        </p>
      ) : (
        <>
          <Podio primeiros={lista.slice(0, 3).map((l) => ({ usuarioId: l.usuarioId, nome: l.nome, ...valor(l) }))} usuarioId={usuario.id} />
          {lista.length > 3 && (
            <ol className="overflow-hidden rounded-2xl border border-borda bg-superficie">
              {lista.slice(3).map((l) => (
                <Linha key={l.usuarioId} linha={l} eu={l.usuarioId === usuario.id} valor={valor(l)} />
              ))}
            </ol>
          )}
        </>
      )}
      {!estouNaLista && lista.length === TAMANHO_RANKING && (
        <p className="text-center text-xs text-suave">Mostrando os {TAMANHO_RANKING} primeiros.</p>
      )}
    </div>
  );
}

function Linha({ linha, eu, valor }: { linha: LinhaRanking; eu: boolean; valor: { grande: string; pequeno: string } }) {
  return (
    <li className={cn("flex items-center gap-3 border-t border-borda px-4 py-3 first:border-t-0", eu && "bg-marca-suave")}>
      <span className="grid w-8 shrink-0 place-items-center text-sm font-extrabold tabular-nums">
        {linha.posicao}º
      </span>
      <span className="min-w-0 flex-1 truncate font-bold">
        {linha.nome}
        {eu && <span className="ml-1.5 text-xs font-extrabold text-marca-clara">(você)</span>}
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-extrabold tabular-nums">{valor.grande}</span>
        <span className="block text-[11px] text-suave">{valor.pequeno}</span>
      </span>
    </li>
  );
}
