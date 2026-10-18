import type { Metadata } from "next";
import { CabecalhoPagina, CardMetrica, classeCabecalhoTabela, Secao, Selo } from "@/components/admin/kit";
import { ASSINATURA, formatarReais, PREFIXO_REFERENCIA } from "@/lib/planos";
import { resumoFaturamento } from "@/server/assinatura";
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
export default async function PaginaFinanceiro() {
  const [r, pessoas] = await Promise.all([resumoFaturamento(), resumoPessoas()]);
  const mesAtual = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const doMes = r.porMes.find((m) => m.mes === mesAtual);
  const total = r.porMes.reduce((s, m) => s + Number(m.total), 0);
  const recusadas = r.ultimos.filter((p) => p.status === "rejected").length;

  return (
    <>
      <CabecalhoPagina
        titulo="Financeiro"
        subtitulo={`Só o dinheiro da Nóbrega Questões (referência "${PREFIXO_REFERENCIA}" no Mercado Pago), separado do LexCursos. Valores brutos, antes das taxas.`}
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
          dica={`${plural(r.assinantesAtivos, "assinante", "assinantes")} × ${formatarReais(ASSINATURA.valor)}`}
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

      <Secao titulo="Faturamento por mês" acao={<span className="text-xs text-suave">Total: {reais(total)}</span>}>
        {r.porMes.length === 0 ? (
          <p className="px-5 pb-8 pt-2 text-center text-sm text-suave">Nenhum pagamento aprovado ainda.</p>
        ) : (
          <GraficoMeses meses={r.porMes} />
        )}
      </Secao>

      <Secao titulo="Últimas cobranças">
        {r.ultimos.length === 0 ? (
          <p className="px-5 pb-8 pt-2 text-center text-sm text-suave">Nenhuma cobrança ainda.</p>
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
