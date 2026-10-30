import { ChevronLeft, ChevronRight, ListTree, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VadeMecumBloqueado } from "@/components/vade-mecum/bloqueado";
import { ComoLer } from "@/components/vade-mecum/como-ler";
import { LeituraLei } from "@/components/vade-mecum/leitura-lei";
import { variantesBotao } from "@/components/ui/button";
import { exigirUsuario } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import { temAcessoCompleto } from "@/server/assinatura";
import { chaveArtigo } from "@/lib/artigos-lei";
import { explicacoesAprovadas } from "@/server/explicacoes";
import { avisosDaLei, carregarLei, questoesPorArtigo, secaoDoArtigo } from "@/server/vade-mecum";

type Props = {
  params: Promise<{ lei: string }>;
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lei = await carregarLei((await params).lei);
  return { title: lei ? lei.nome : "Vade Mecum" };
}

export default async function PaginaLei({ params, searchParams }: Props) {
  const usuario = await exigirUsuario();
  if (!(await temAcessoCompleto(usuario))) return <VadeMecumBloqueado />;
  const { lei: id } = await params;
  const sp = await searchParams;
  const lei = await carregarLei(id);
  if (!lei) notFound();

  // "Ir para o artigo": acha a seção dele e desce até o cartão.
  const artigo = typeof sp.art === "string" ? sp.art.trim() : "";
  if (artigo) {
    const achado = secaoDoArtigo(lei, artigo);
    if (achado) redirect(`/vade-mecum/${lei.id}?secao=${achado.secao}#${achado.id}`);
  }
  const pedida = Number(typeof sp.secao === "string" ? sp.secao : 0);
  const indice = Number.isInteger(pedida) && pedida >= 0 && pedida < lei.secoes.length ? pedida : 0;
  const secao = lei.secoes[indice]!;
  const anterior = lei.secoes[indice - 1];
  const proxima = lei.secoes[indice + 1];
  const numeros = secao.nos.flatMap((n) => (n.tipo === "artigo" ? [n.numero] : []));
  const [questoes, explicacoes] = await Promise.all([
    questoesPorArtigo(lei.id, numeros),
    explicacoesAprovadas(lei.id, numeros.map(chaveArtigo)),
  ]);
  const faixa = (s: typeof secao) => (s.primeiro ? `arts. ${s.primeiro}${s.ultimo && s.ultimo !== s.primeiro ? ` a ${s.ultimo}` : ""}` : "");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/vade-mecum" className="text-sm font-bold text-marca-clara hover:underline">
          Vade Mecum
        </Link>
        <h1 className="mt-1 text-[24px] font-extrabold leading-[1.15] tracking-[-.02em] sm:text-[30px]">{lei.nome}</h1>
        <p className="mt-1 text-xs text-suave">
          Texto compilado do Planalto{lei.baixadaEm ? `, atualizado em ${lei.baixadaEm.split("-").reverse().join("/")}` : ""}. Trechos revogados ficam
          marcados.{" "}
          <a href={lei.fonte} target="_blank" rel="noreferrer" className="underline">
            Ver no Planalto
          </a>
        </p>
      </div>

      <ComoLer />

      {/* Ir para o artigo e sumário */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <form action={`/vade-mecum/${lei.id}`} className="flex flex-1 items-center gap-2 rounded-xl border border-borda bg-superficie px-3">
          <Search className="size-4 shrink-0 text-suave" aria-hidden />
          <input
            name="art"
            inputMode="text"
            placeholder="Ir para o artigo (ex.: 121)"
            aria-label="Número do artigo"
            className="h-11 min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button type="submit" className="text-sm font-bold text-marca-clara">
            Ir
          </button>
        </form>
      </div>
      {artigo && <p className="text-sm text-erro">Não achei o art. {artigo} nesta lei.</p>}

      {lei.secoes.length > 1 && (
        <details className="group rounded-xl border border-borda bg-superficie">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
            <ListTree className="size-4 text-marca-clara" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              {secao.rotulo}
              {secao.nome && <span className="font-semibold text-suave"> · {secao.nome}</span>}
            </span>
            <span className="text-xs text-marca-clara group-open:hidden">Sumário</span>
          </summary>
          <ul className="max-h-[60vh] overflow-y-auto border-t border-borda">
            {lei.secoes.map((s) => (
              <li key={s.indice}>
                <Link
                  href={`/vade-mecum/${lei.id}?secao=${s.indice}`}
                  className={cn("block px-4 py-2.5 text-sm hover:bg-camada", s.indice === indice && "bg-marca-suave")}
                >
                  <span className="font-bold">{s.rotulo}</span>
                  {s.nome && <span className="text-suave"> · {s.nome}</span>}
                  {faixa(s) && <span className="block text-xs text-suave">{faixa(s)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <LeituraLei nos={secao.nos} extras={{ lei: lei.id, questoes, avisos: avisosDaLei(lei.id), explicacoes }} />

      {/* Anterior e próxima seção */}
      {(anterior || proxima) && (
        <nav className="flex gap-3 pt-2" aria-label="Seções">
          {anterior ? (
            <Link href={`/vade-mecum/${lei.id}?secao=${anterior.indice}`} className={variantesBotao({ variante: "contorno", className: "h-auto flex-1 justify-start py-2.5" })}>
              <ChevronLeft className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate text-left">{anterior.rotulo}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {proxima && (
            <Link href={`/vade-mecum/${lei.id}?secao=${proxima.indice}`} className={variantesBotao({ className: "h-auto flex-1 justify-end py-2.5" })}>
              <span className="min-w-0 truncate text-right">{proxima.rotulo}</span>
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
