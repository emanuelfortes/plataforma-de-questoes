import type { Metadata } from "next";
import Link from "next/link";
import { CartaoExplicacao } from "@/components/admin/cartao-explicacao";
import { CabecalhoPagina, CardMetrica, Secao } from "@/components/admin/kit";
import { LeituraLei } from "@/components/vade-mecum/leitura-lei";
import { STATUS_EXPLICACAO, type StatusExplicacao } from "@/lib/explicacao";
import { cn, formatarNumero } from "@/lib/utils";
import { listarExplicacoes, resumoExplicacoes } from "@/server/explicacoes";
import { nomeDaLei, nosDoArtigo } from "@/server/vade-mecum";

export const metadata: Metadata = { title: "Explicações do Vade Mecum" };

const ROTULO: Record<StatusExplicacao, string> = { pendente: "Pendentes", aprovada: "Aprovadas", rejeitada: "Rejeitadas" };

// exigirAdmin() já roda no layout de /admin; a ação de decidir também o chama.
export default async function PaginaExplicacoes({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status: StatusExplicacao = STATUS_EXPLICACAO.includes(sp.status as StatusExplicacao) ? (sp.status as StatusExplicacao) : "pendente";
  const [resumo, itens] = await Promise.all([resumoExplicacoes(), listarExplicacoes(status)]);
  const textos = await Promise.all(itens.map((i) => nosDoArtigo(i.lei, i.artigo)));

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Explicações do Vade Mecum"
        subtitulo="O 'Entender este artigo' que o aluno vê. A IA escreve; você confere com o texto da lei ao lado e aprova. Só as aprovadas aparecem."
      />
      <div className="grid grid-cols-3 gap-3">
        {STATUS_EXPLICACAO.map((s) => (
          <Link key={s} href={`/admin/vade-mecum?status=${s}`} className={cn("rounded-2xl", s === status && "ring-2 ring-marca")}>
            <CardMetrica rotulo={ROTULO[s]} valor={formatarNumero(resumo[s])} />
          </Link>
        ))}
      </div>
      {itens.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borda p-8 text-center text-sm text-suave">Nada aqui.</p>
      ) : (
        itens.map((item, i) => (
          <Secao key={`${item.lei}:${item.artigo}`} titulo={`Art. ${item.artigo} · ${nomeDaLei(item.lei) ?? item.lei}`}>
            <div className="grid gap-4 p-4 pt-2 sm:p-5 sm:pt-2 lg:grid-cols-2">
              <div className="max-h-[70vh] overflow-y-auto rounded-xl bg-fundo p-2">
                <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[.06em] text-suave">Texto oficial</p>
                <LeituraLei nos={textos[i]!} />
              </div>
              <CartaoExplicacao
                key={`${item.lei}:${item.artigo}:${item.status}`}
                lei={item.lei}
                artigo={item.artigo}
                inicial={{ sentido: item.sentido, pontos: item.pontos, exemplo: item.exemplo, pegadinha: item.pegadinha }}
                conferir={item.conferir}
              />
            </div>
          </Secao>
        ))
      )}
    </div>
  );
}
