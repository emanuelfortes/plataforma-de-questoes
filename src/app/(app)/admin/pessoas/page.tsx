import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina, CardMetrica, classeCabecalhoTabela, Secao, Selo } from "@/components/admin/kit";
import { cn, formatarNumero } from "@/lib/utils";
import {
  listarPessoas,
  resumoPessoas,
  ROTULO_SITUACAO,
  type FiltroPessoas,
  type Situacao,
} from "@/server/pessoas";

export const metadata: Metadata = { title: "Pessoas" };

const TOM_SITUACAO: Record<Situacao, "acerto" | "marca" | "destaque" | "erro" | "neutro"> = {
  assinante: "acerto",
  cancelado: "destaque",
  pendente: "marca",
  gratis: "neutro",
  equipe: "marca",
};

const ABAS: { filtro: FiltroPessoas; rotulo: string }[] = [
  { filtro: "todos", rotulo: "Todos" },
  { filtro: "assinante", rotulo: "Assinantes" },
  { filtro: "gratis", rotulo: "Plano grátis" },
  { filtro: "cancelado", rotulo: "Cancelaram" },
  { filtro: "pendente", rotulo: "Pendentes" },
  { filtro: "equipe", rotulo: "Equipe" },
];

const dataCurta = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

type Params = Promise<{ situacao?: string; q?: string; pagina?: string }>;

// exigirAdmin() já roda no layout de /admin; as consultas daqui só leem dados.
export default async function PaginaPessoas({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const filtro = (ABAS.some((a) => a.filtro === sp.situacao) ? sp.situacao : "todos") as FiltroPessoas;
  const busca = (sp.q ?? "").slice(0, 100);
  const pagina = Math.max(1, Number.parseInt(sp.pagina ?? "1", 10) || 1);

  const [resumo, lista] = await Promise.all([resumoPessoas(), listarPessoas({ filtro, busca, pagina })]);
  const contagem = (f: FiltroPessoas) =>
    f === "todos" ? resumo.cadastrados + resumo.porSituacao.equipe : resumo.porSituacao[f];

  const link = (mudancas: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const atual = { situacao: filtro === "todos" ? undefined : filtro, q: busca || undefined, pagina: undefined, ...mudancas };
    for (const [k, v] of Object.entries(atual)) if (v !== undefined && v !== "" && !(k === "pagina" && String(v) === "1")) p.set(k, String(v));
    return `/admin/pessoas${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <CabecalhoPagina titulo="Pessoas" subtitulo="Quem se cadastrou, quem assina e quem usa o plano grátis." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CardMetrica
          rotulo="Cadastrados"
          valor={formatarNumero(resumo.cadastrados)}
          dica={`+${resumo.novos7} nos últimos 7 dias`}
          tom="acerto"
        />
        <CardMetrica
          rotulo="Assinantes ativos"
          valor={formatarNumero(resumo.porSituacao.assinante)}
          dica={`${String(resumo.conversao).replace(".", ",")}% dos cadastrados`}
          destaque
        />
        <CardMetrica rotulo="Plano grátis" valor={formatarNumero(resumo.porSituacao.gratis)} dica="10 questões por dia" />
        <CardMetrica
          rotulo="Cancelaram"
          valor={formatarNumero(resumo.porSituacao.cancelado)}
          dica="ainda com acesso até o fim do mês pago"
          tom={resumo.porSituacao.cancelado ? "destaque" : "normal"}
        />
      </div>

      <Secao>
        <div className="space-y-3 p-4 sm:p-5">
          <nav aria-label="Situação" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
            {ABAS.map((a) => (
              <Link
                key={a.filtro}
                href={link({ situacao: a.filtro === "todos" ? undefined : a.filtro })}
                aria-current={filtro === a.filtro ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                  filtro === a.filtro ? "border-marca bg-marca text-sobre-marca" : "border-borda text-texto/75 hover:bg-camada-forte",
                )}
              >
                {a.rotulo}
                <span className="tabular-nums opacity-70">{formatarNumero(contagem(a.filtro))}</span>
              </Link>
            ))}
          </nav>
          <form action="/admin/pessoas" className="flex gap-2">
            {filtro !== "todos" && <input type="hidden" name="situacao" value={filtro} />}
            <input
              name="q"
              defaultValue={busca}
              placeholder="Buscar por nome ou e-mail"
              className="h-10 min-w-0 flex-1 rounded-lg border border-borda bg-camada px-3 text-sm placeholder:text-suave focus-visible:outline-2 focus-visible:outline-marca"
            />
            <button type="submit" className="h-10 rounded-lg bg-marca px-4 text-sm font-bold text-sobre-marca hover:bg-marca-forte">
              Buscar
            </button>
          </form>
        </div>

        {lista.pessoas.length === 0 ? (
          <p className="border-t border-borda px-5 py-10 text-center text-sm text-suave">Ninguém encontrado.</p>
        ) : (
          <div className="overflow-x-auto border-t border-borda">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className={classeCabecalhoTabela}>
                  <th className="px-4 py-3 sm:px-5">Pessoa</th>
                  <th className="px-3">Situação</th>
                  <th className="px-3 text-right">Questões</th>
                  <th className="px-3 sm:pr-5">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {lista.pessoas.map((p) => (
                  <tr key={p.id} className="border-t border-borda">
                    <td className="px-4 py-2.5 sm:px-5">
                      <span className="block font-bold">{p.nome}</span>
                      <span className="block text-xs text-suave">
                        {p.email}
                        {!p.emailConfirmado && " · e-mail não confirmado"}
                      </span>
                    </td>
                    <td className="px-3">
                      <Selo tom={TOM_SITUACAO[p.situacao]}>{ROTULO_SITUACAO[p.situacao]}</Selo>
                    </td>
                    <td className="px-3 text-right tabular-nums">{formatarNumero(p.resolvidas)}</td>
                    <td className="whitespace-nowrap px-3 tabular-nums text-suave sm:pr-5">{dataCurta(p.criadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lista.paginas > 1 && (
          <div className="flex items-center justify-between border-t border-borda px-4 py-3 text-sm sm:px-5">
            <span className="text-suave">
              Página {pagina} de {lista.paginas} · {formatarNumero(lista.total)} pessoas
            </span>
            <div className="flex gap-2">
              {pagina > 1 && (
                <Link href={link({ pagina: pagina - 1 })} className="font-bold text-marca-clara hover:underline">
                  Anterior
                </Link>
              )}
              {pagina < lista.paginas && (
                <Link href={link({ pagina: pagina + 1 })} className="font-bold text-marca-clara hover:underline">
                  Próxima
                </Link>
              )}
            </div>
          </div>
        )}
      </Secao>
    </>
  );
}
