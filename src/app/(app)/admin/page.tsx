import type { Metadata } from "next";
import { CabecalhoPagina, CardMetrica, LinkBotao, Secao, Selo } from "@/components/admin/kit";
import { ultimosDias, rotuloDia } from "@/lib/datas";
import { formatarReais } from "@/lib/planos";
import { formatarNumero } from "@/lib/utils";
import { resumoFaturamento } from "@/server/assinatura";
import { cadastrosPorDia, resumoPessoas, ROTULO_SITUACAO, totaisConteudo } from "@/server/pessoas";

export const metadata: Metadata = { title: "Área do dono" };

const reais = (centavos: number) => formatarReais(centavos / 100);

/** Novos cadastros por dia (30 dias), em barras CSS. */
function GraficoCadastros({ porDia }: { porDia: Map<string, number> }) {
  const dias = ultimosDias(30);
  const maior = Math.max(1, ...dias.map((d) => porDia.get(d) ?? 0));
  return (
    <div className="px-4 pb-4 sm:px-5">
      <div className="flex h-28 items-end gap-0.75" role="img" aria-label="Novos cadastros por dia nos últimos 30 dias">
        {dias.map((d) => {
          const n = porDia.get(d) ?? 0;
          return (
            <div
              key={d}
              title={`${rotuloDia(d)}: ${n}`}
              className={n ? "flex-1 rounded-t-sm bg-marca" : "flex-1 rounded-t-sm bg-white/10"}
              style={{ height: `${Math.max(4, (n / maior) * 100)}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-bold text-suave">
        <span>{rotuloDia(dias[0]!)}</span>
        <span>hoje</span>
      </div>
    </div>
  );
}

// exigirAdmin() já roda no layout de /admin.
export default async function PaginaVisaoGeral() {
  const [pessoas, faturamento, conteudo, cadastros] = await Promise.all([
    resumoPessoas(),
    resumoFaturamento(),
    totaisConteudo(),
    cadastrosPorDia(),
  ]);
  const mesAtual = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const doMes = faturamento.porMes.find((m) => m.mes === mesAtual);
  const porDia = new Map(cadastros.map((c) => [c.dia, Number(c.n)]));

  return (
    <>
      <CabecalhoPagina
        titulo="Visão geral"
        subtitulo="Como está a Nóbrega Questões hoje."
        acoes={<LinkBotao href="/admin/questoes">Importar questões</LinkBotao>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CardMetrica
          rotulo="Faturado este mês"
          valor={reais(Number(doMes?.total ?? 0))}
          dica={`MRR ${reais(faturamento.mrrCentavos)}`}
          destaque
        />
        <CardMetrica
          rotulo="Assinantes ativos"
          valor={formatarNumero(pessoas.porSituacao.assinante)}
          dica={`${String(pessoas.conversao).replace(".", ",")}% dos cadastrados`}
          tom="acerto"
        />
        <CardMetrica
          rotulo="Cadastrados"
          valor={formatarNumero(pessoas.cadastrados)}
          dica={`+${pessoas.novos7} em 7 dias · +${pessoas.novos30} em 30`}
        />
        <CardMetrica
          rotulo="Banco de conteúdo"
          valor={formatarNumero(conteudo.questoes)}
          dica={`questões · ${formatarNumero(conteudo.flashcards)} flashcards`}
        />
      </div>

      <Secao titulo="Novos cadastros (30 dias)" acao={<LinkBotao href="/admin/pessoas">Ver pessoas</LinkBotao>}>
        <GraficoCadastros porDia={porDia} />
      </Secao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Secao titulo="Últimos cadastros">
          {pessoas.recentes.length === 0 ? (
            <p className="px-5 pb-6 pt-1 text-sm text-suave">Ninguém ainda.</p>
          ) : (
            <ul className="divide-y divide-borda">
              {pessoas.recentes.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{p.nome}</span>
                    <span className="block truncate text-xs text-suave">{p.email}</span>
                  </span>
                  <Selo tom={p.situacao === "assinante" ? "acerto" : "neutro"}>{ROTULO_SITUACAO[p.situacao]}</Selo>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao titulo="Últimas cobranças" acao={<LinkBotao href="/admin/financeiro">Financeiro</LinkBotao>}>
          {faturamento.ultimos.length === 0 ? (
            <p className="px-5 pb-6 pt-1 text-sm text-suave">Nenhuma cobrança ainda.</p>
          ) : (
            <ul className="divide-y divide-borda">
              {faturamento.ultimos.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{c.nome ?? "(conta excluída)"}</span>
                    <span className="block text-xs text-suave">
                      {c.cobradoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>
                  </span>
                  <span className={c.status === "approved" ? "font-bold text-acerto" : "font-bold text-erro"}>
                    {reais(c.valorCentavos)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>
    </>
  );
}
