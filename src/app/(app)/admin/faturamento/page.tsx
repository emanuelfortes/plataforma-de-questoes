import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatarReais, PREFIXO_REFERENCIA } from "@/lib/planos";
import { exigirAdmin } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import { resumoFaturamento } from "@/server/assinatura";

export const metadata: Metadata = { title: "Faturamento" };

const STATUS_PAGAMENTO: Record<string, { rotulo: string; cor: string }> = {
  approved: { rotulo: "Aprovado", cor: "text-acerto" },
  pending: { rotulo: "Pendente", cor: "text-destaque" },
  in_process: { rotulo: "Em análise", cor: "text-destaque" },
  rejected: { rotulo: "Recusado", cor: "text-erro" },
  cancelled: { rotulo: "Cancelado", cor: "text-suave" },
  refunded: { rotulo: "Reembolsado", cor: "text-suave" },
  charged_back: { rotulo: "Contestado", cor: "text-erro" },
};

const reais = (centavos: number) => formatarReais(centavos / 100);

function nomeMes(aaaaMm: string) {
  const [ano, mes] = aaaaMm.split("-").map(Number);
  const nome = new Date(Date.UTC(ano!, mes! - 1, 15)).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

export default async function PaginaFaturamento() {
  await exigirAdmin();
  const r = await resumoFaturamento();
  const mesAtual = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const doMes = r.porMes.find((m) => m.mes === mesAtual);

  const cartoes = [
    { rotulo: "Faturado este mês", valor: reais(Number(doMes?.total ?? 0)), detalhe: `${doMes?.quantidade ?? 0} pagamentos aprovados` },
    { rotulo: "Assinantes ativos", valor: String(r.assinantesAtivos), detalhe: "cobrança automática em dia" },
    { rotulo: "Receita mensal recorrente", valor: reais(r.mrrCentavos), detalhe: "se todos os ativos renovarem" },
    { rotulo: "Cancelamentos", valor: String(r.porStatus.cancelled ?? 0), detalhe: "desde o início" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/admin" className="text-sm font-bold text-marca-clara hover:underline">
          Área do dono
        </Link>
        <h1 className="mt-1 text-[34px] font-extrabold leading-[1.1] tracking-[-.03em]">Faturamento</h1>
        <p className="mt-2 text-sm text-suave">
          Só o dinheiro da Nóbrega Questões (cobranças com a referência &quot;{PREFIXO_REFERENCIA}&quot;), separado de
          outros produtos na mesma conta do Mercado Pago. Valores brutos, antes das taxas do Mercado Pago.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cartoes.map((c) => (
          <Card key={c.rotulo} className="bg-white/5 p-4">
            <p className="text-xs font-bold text-suave">{c.rotulo}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{c.valor}</p>
            <p className="mt-1 text-xs text-suave">{c.detalhe}</p>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Por mês</h2>
        {r.porMes.length === 0 ? (
          <p className="text-sm text-suave">Nenhum pagamento aprovado ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-borda">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs text-suave">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Mês</th>
                  <th className="px-3 font-bold">Pagamentos</th>
                  <th className="px-3 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {r.porMes.map((m) => (
                  <tr key={m.mes} className="border-t border-borda">
                    <td className="px-4 py-2.5 font-semibold">{nomeMes(m.mes)}</td>
                    <td className="px-3 tabular-nums">{m.quantidade}</td>
                    <td className="px-3 text-right font-bold tabular-nums">{reais(Number(m.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Últimas cobranças</h2>
        {r.ultimos.length === 0 ? (
          <p className="text-sm text-suave">Nenhuma cobrança ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-borda">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs text-suave">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Data</th>
                  <th className="px-3 font-bold">Aluno</th>
                  <th className="px-3 font-bold">Situação</th>
                  <th className="px-3 text-right font-bold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {r.ultimos.map((p) => {
                  const s = STATUS_PAGAMENTO[p.status] ?? { rotulo: p.status, cor: "text-suave" };
                  return (
                    <tr key={p.id} className="border-t border-borda">
                      <td className="px-4 py-2.5 tabular-nums">
                        {p.cobradoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </td>
                      <td className="px-3">
                        <span className="font-semibold">{p.nome ?? "(conta excluída)"}</span>
                        {p.email && <span className="block text-xs text-suave">{p.email}</span>}
                      </td>
                      <td className={cn("px-3 font-bold", s.cor)}>{s.rotulo}</td>
                      <td className="px-3 text-right tabular-nums">{reais(p.valorCentavos)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
