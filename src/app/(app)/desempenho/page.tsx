import type { Metadata } from "next";
import { GraficoDiario } from "@/components/desempenho/grafico-diario";
import { Card, CardTitulo } from "@/components/ui/card";
import { exigirUsuario } from "@/lib/sessao";
import { cn, formatarNumero } from "@/lib/utils";
import { obterJanelas, obterPorDisciplina, obterSerieDiaria } from "@/server/desempenho";

export const metadata: Metadata = { title: "Desempenho" };

export default async function PaginaDesempenho() {
  const usuario = await exigirUsuario();
  const [janelas, serie, porDisciplina] = await Promise.all([
    obterJanelas(usuario.id),
    obterSerieDiaria(usuario.id, 30),
    obterPorDisciplina(usuario.id, 30),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Desempenho</h1>
        <p className="mt-1 text-sm text-suave">
          Acertos e erros por período. Cada tentativa conta, inclusive quando você refaz uma questão.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Resumo por período">
        {janelas.map((j) => (
          <Card key={j.chave} className="p-4">
            <p className="text-xs font-medium text-suave">{j.rotulo}</p>
            <p
              className={cn(
                "mt-2 text-3xl font-semibold tabular-nums",
                !j.total && "text-suave",
              )}
            >
              {j.total ? `${j.percentual}%` : "0%"}
            </p>
            <div
              className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-fundo"
              role="img"
              aria-label={`${j.acertos} acertos e ${j.erros} erros`}
            >
              {j.total > 0 && (
                <>
                  <div className="bg-acerto" style={{ width: `${(j.acertos / j.total) * 100}%` }} />
                  <div className="bg-erro" style={{ width: `${(j.erros / j.total) * 100}%` }} />
                </>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-1 text-xs">
              <div>
                <dt className="text-suave">Acertos</dt>
                <dd className="font-semibold tabular-nums text-acerto">{formatarNumero(j.acertos)}</dd>
              </div>
              <div>
                <dt className="text-suave">Erros</dt>
                <dd className="font-semibold tabular-nums text-erro">{formatarNumero(j.erros)}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </section>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitulo>Últimos 30 dias</CardTitulo>
          <div className="flex gap-4 text-xs text-suave">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-acerto" /> Acertos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-erro" /> Erros
            </span>
          </div>
        </div>
        <GraficoDiario dados={serie} />
      </Card>

      <Card>
        <CardTitulo className="mb-4">Por disciplina (30 dias)</CardTitulo>
        {porDisciplina.length === 0 ? (
          <p className="text-sm text-suave">Resolva algumas questões para ver este quadro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs text-suave">
                  <th className="py-2 font-medium">Disciplina</th>
                  <th className="py-2 text-right font-medium">Resolvidas</th>
                  <th className="py-2 text-right font-medium">Acertos</th>
                  <th className="py-2 text-right font-medium">Erros</th>
                  <th className="py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {porDisciplina.map((d) => (
                  <tr key={d.disciplina} className="border-b border-borda last:border-0">
                    <td className="py-2.5">{d.disciplina}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatarNumero(d.total)}</td>
                    <td className="py-2.5 text-right tabular-nums text-acerto">{formatarNumero(d.acertos)}</td>
                    <td className="py-2.5 text-right tabular-nums text-erro">{formatarNumero(d.erros)}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{d.percentual}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
