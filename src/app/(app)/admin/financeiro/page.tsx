import { CreditCard, QrCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina, CardMetrica, classeCabecalhoTabela, Secao, Selo } from "@/components/admin/kit";
import { formatarReais, PREFIXO_REFERENCIA } from "@/lib/planos";
import { cn } from "@/lib/utils";
import { conferirCobrancasPendentes, resumoFaturamento, type FormaPagamento } from "@/server/assinatura";
import { resumoPessoas } from "@/server/pessoas";

export const metadata: Metadata = { title: "Financeiro" };

const STATUS_PAGAMENTO: Record<string, { rotulo: string; tom: "acerto" | "destaque" | "erro" | "neutro" }> = {
  approved: { rotulo: "Aprovado", tom: "acerto" },
  pending: { rotulo: "Pendente", tom: "destaque" },
  in_process: { rotulo: "Em análise", tom: "destaque" },
  rejected: { rotulo: "Recusado", tom: "erro" },
  cancelled: { rotulo: "Cancelado", tom: "neutro" },
  refunded: { rotulo: "Reembolsado", tom: "neutro" },
  charged_back: { rotulo: "Contestado", tom: "erro" },
};

const reais = (centavos: number) => formatarReais(centavos / 100);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function nomeMes(aaaaMm: string) {
  const [ano, mes] = aaaaMm.split("-").map(Number);
  const nome = new Date(Date.UTC(ano!, mes! - 1, 15)).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

/** Barras dos últimos meses (do mais antigo ao atual), em CSS: sem biblioteca de gráfico. */
function GraficoMeses({ meses }: { meses: { mes: string; total: number }[] }) {
  const ordem = [...meses].reverse();
  const maior = Math.max(1, ...ordem.map((m) => Number(m.total)));
  return (
    <div className="flex h-44 items-end justify-center gap-2 px-4 pb-4 sm:px-5" role="img" aria-label="Faturamento por mês">
      {ordem.map((m) => (
        <div key={m.mes} className="flex min-w-0 max-w-20 flex-1 flex-col items-center gap-1.5">
          <span className="text-[10px] font-bold tabular-nums text-suave">{reais(Number(m.total)).replace("R$", "").trim()}</span>
          <div
            className="w-full rounded-t-md bg-marca"
            style={{ height: `${Math.max(4, (Number(m.total) / maior) * 120)}px` }}
          />
          <span className="text-[10px] font-bold uppercase text-suave">{nomeMes(m.mes).slice(0, 3)}</span>
        </div>
      ))}
    </div>
  );
}

// exigirAdmin() já roda no layout de /admin.
const FORMAS: { valor?: FormaPagamento; rotulo: string }[] = [
  { rotulo: "Todas" },
  { valor: "pix", rotulo: "Pix" },
  { valor: "cartao", rotulo: "Cartão" },
];

export default async function PaginaFinanceiro({ searchParams }: { searchParams: Promise<{ forma?: string }> }) {
  const { forma: formaUrl } = await searchParams;
  const forma = formaUrl === "pix" || formaUrl === "cartao" ? formaUrl : undefined;
  // Cobrança do cartão que ainda não entrou (sem esperar a conferência diária das 6h).
  await conferirCobrancasPendentes();
  const [r, pessoas] = await Promise.all([resumoFaturamento(forma), resumoPessoas()]);
  const mesAtual = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const doMes = r.porMes.find((m) => m.mes === mesAtual);
  const total = r.porMes.reduce((s, m) => s + Number(m.total), 0);
  const recusadas = r.ultimos.filter((p) => p.status === "rejected").length;

  return (
    <>
      <CabecalhoPagina
        titulo="Financeiro"
        subtitulo={`Só o dinheiro desta plataforma (Efí e, das assinaturas antigas, o Mercado Pago com a referência "${PREFIXO_REFERENCIA}"), separado do LexCursos. Valores brutos, antes das taxas.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CardMetrica
          rotulo="Faturado este mês"
          valor={reais(Number(doMes?.total ?? 0))}
          dica={plural(doMes?.quantidade ?? 0, "pagamento aprovado", "pagamentos aprovados")}
          destaque
        />
        <CardMetrica
          rotulo="Receita recorrente (MRR)"
          valor={reais(r.mrrCentavos)}
          dica={`soma das ${plural(r.assinantesAtivos, "assinatura ativa", "assinaturas ativas")} (cartão e Pix pago em dia, Basic e Tropa de Elite)`}
          tom="acerto"
        />
        <CardMetrica
          rotulo="Conversão"
          valor={`${String(pessoas.conversao).replace(".", ",")}%`}
          dica={`${pessoas.porSituacao.assinante} de ${pessoas.cadastrados} cadastrados assinam`}
        />
        <CardMetrica
          rotulo="Cancelamentos"
          valor={String(r.porStatus.cancelled ?? 0)}
          dica={recusadas ? plural(recusadas, "cobrança recusada recente", "cobranças recusadas recentes") : "desde o início"}
          tom={recusadas ? "erro" : "normal"}
        />
      </div>

      <Secao titulo="Pix x cartão">
        <div className="grid gap-3 px-4 pb-5 sm:grid-cols-2 sm:px-5">
          <CardForma
            icone={<QrCode className="size-5" aria-hidden />}
            titulo="Pix"
            dados={r.porForma.pix}
            totalMes={Number(doMes?.total ?? 0)}
            nota="Cada Pix vale 30 dias e não renova sozinho"
          />
          <CardForma
            icone={<CreditCard className="size-5" aria-hidden />}
            titulo="Cartão de crédito"
            dados={r.porForma.cartao}
            totalMes={Number(doMes?.total ?? 0)}
            nota="Mensal com renovação automática"
          />
        </div>
      </Secao>

      <Secao titulo="Faturamento por mês" acao={<span className="text-xs text-suave">Total: {reais(total)}</span>}>
        {r.porMes.length === 0 ? (
          <p className="px-5 pb-8 pt-2 text-center text-sm text-suave">Nenhum pagamento aprovado ainda.</p>
        ) : (
          <GraficoMeses meses={r.porMes} />
        )}
      </Secao>

      <Secao
        titulo="Últimas cobranças"
        acao={
          <nav className="flex gap-1" aria-label="Forma de pagamento">
            {FORMAS.map((f) => (
              <Link
                key={f.rotulo}
                href={f.valor ? `/admin/financeiro?forma=${f.valor}` : "/admin/financeiro"}
                aria-current={forma === f.valor ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-bold",
                  forma === f.valor ? "bg-marca text-sobre-marca" : "text-suave hover:bg-camada hover:text-texto",
                )}
              >
                {f.rotulo}
              </Link>
            ))}
          </nav>
        }
      >
        {r.ultimos.length === 0 ? (
          <p className="px-5 pb-8 pt-2 text-center text-sm text-suave">
            {forma ? `Nenhuma cobrança no ${forma === "pix" ? "Pix" : "cartão"} ainda.` : "Nenhuma cobrança ainda."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className={classeCabecalhoTabela}>
                  <th className="px-4 py-3 sm:px-5">Data</th>
                  <th className="px-3">Aluno</th>
                  <th className="px-3">Situação</th>
                  <th className="px-3 text-right sm:pr-5">Valor</th>
                </tr>
              </thead>
              <tbody>
                {r.ultimos.map((p) => {
                  const s = STATUS_PAGAMENTO[p.status] ?? { rotulo: p.status, tom: "neutro" as const };
                  return (
                    <tr key={p.id} className="border-t border-borda">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums sm:px-5">
                        {p.cobradoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </td>
                      <td className="px-3">
                        <span className="block font-bold">{p.nome ?? "(conta excluída)"}</span>
                        {p.email && <span className="block text-xs text-suave">{p.email}</span>}
                      </td>
                      <td className="px-3">
                        <Selo tom={s.tom}>{s.rotulo}</Selo>
                        <span className="ml-2 text-xs text-suave">
                          {p.assinaturaId.startsWith("pix:") ? "Pix" : "Cartão"}
                          {p.assinaturaId.startsWith("pix:efi:") || p.assinaturaId.startsWith("efi:") ? " (Efí)" : " (MP)"}
                        </span>
                      </td>
                      <td className="px-3 text-right tabular-nums sm:pr-5">{reais(p.valorCentavos)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </>
  );
}

/** Quanto entrou por uma forma de pagamento (aprovado) e quantos assinantes ativos ela tem. */
function CardForma({
  icone,
  titulo,
  dados,
  totalMes,
  nota,
}: {
  icone: React.ReactNode;
  titulo: string;
  dados: { mes: number; quantidadeMes: number; total: number; quantidade: number; ativos: number };
  totalMes: number;
  nota: string;
}) {
  const parte = totalMes > 0 ? Math.round((dados.mes / totalMes) * 100) : 0;
  return (
    <div className="rounded-2xl border border-borda bg-superficie p-4">
      <p className="flex items-center gap-2 font-extrabold">
        <span className="text-marca-clara">{icone}</span>
        {titulo}
      </p>
      <p className="mt-3 text-[13px] text-suave">Recebido este mês</p>
      <p className="text-[26px] font-extrabold leading-tight tracking-tight tabular-nums">{reais(dados.mes)}</p>
      <p className="text-xs font-semibold text-suave">
        {plural(dados.quantidadeMes, "pagamento", "pagamentos")}
        {totalMes > 0 && ` · ${parte}% do mês`}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-borda pt-3 text-sm">
        <div>
          <dt className="text-xs text-suave">Assinantes ativos</dt>
          <dd className="font-extrabold tabular-nums">{dados.ativos}</dd>
        </div>
        <div>
          <dt className="text-xs text-suave">Desde o início</dt>
          <dd className="font-extrabold tabular-nums">{reais(dados.total)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-suave">{nota}</p>
    </div>
  );
}
