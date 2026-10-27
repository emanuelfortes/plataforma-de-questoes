import type { Metadata } from "next";
import { GraficoDiario } from "@/components/desempenho/grafico-diario";
import { Card, CardTitulo } from "@/components/ui/card";
import { exigirUsuario } from "@/lib/sessao";
import { cn, formatarNumero } from "@/lib/utils";
import { RecursoBloqueado } from "@/components/recurso-bloqueado";
import { temAcessoCompleto } from "@/server/assinatura";
import { obterJanelas, obterPorDisciplina, obterSerieDiaria } from "@/server/desempenho";

export const metadata: Metadata = { title: "Desempenho" };

export default async function PaginaDesempenho() {
  const usuario = await exigirUsuario();
  if (!(await temAcessoCompleto(usuario))) return <DesempenhoBloqueado />;
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

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Resumo por período">
        {janelas.map((j) => (
          <Card key={j.chave} className="p-4 first:col-span-2 lg:first:col-span-1">
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
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

      <Card className="p-4 sm:p-5">
        <CardTitulo className="mb-4">Por disciplina (30 dias)</CardTitulo>
        {porDisciplina.length === 0 ? (
          <p className="text-sm text-suave">Resolva algumas questões para ver este quadro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs text-suave">
                  <th className="py-2 pr-3 font-medium">Disciplina</th>
                  <th className="hidden py-2 pl-4 text-right sm:table-cell font-medium">Resolvidas</th>
                  <th className="py-2 pl-4 text-right font-medium">Acertos</th>
                  <th className="py-2 pl-4 text-right font-medium">Erros</th>
                  <th className="py-2 pl-4 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {porDisciplina.map((d) => (
                  <tr key={d.disciplina} className="border-b border-borda last:border-0">
                    <td className="py-2.5">{d.disciplina}</td>
                    <td className="hidden py-2.5 pl-4 text-right sm:table-cell tabular-nums">{formatarNumero(d.total)}</td>
                    <td className="py-2.5 pl-4 text-right tabular-nums text-acerto">{formatarNumero(d.acertos)}</td>
                    <td className="py-2.5 pl-4 text-right tabular-nums text-erro">{formatarNumero(d.erros)}</td>
                    <td className="py-2.5 pl-4 text-right font-semibold tabular-nums">{d.percentual}%</td>
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

/** Aluno grátis: prévia ilustrativa (números fixos, não são dele) atrás do cadeado. */
function DesempenhoBloqueado() {
  const barras = [40, 65, 30, 80, 55, 90, 70, 45, 85, 60, 75, 95];
  return (
    <RecursoBloqueado
      titulo="Desempenho"
      descricao="Seus acertos e erros por período e por matéria, para saber exatamente onde reforçar."
      beneficios={[
        "Acertos de hoje, de ontem e dos últimos 7, 15 e 30 dias",
        "Gráfico dia a dia do seu estudo",
        "Por matéria: onde você vai bem e onde precisa reforçar",
      ]}
      previa={
        <div className="space-y-4 bg-superficie p-5">
          <div className="grid grid-cols-3 gap-2">
            {["Hoje", "7 dias", "30 dias"].map((r, i) => (
              <div key={r} className="rounded-xl border border-borda p-3">
                <p className="text-xs text-suave">{r}</p>
                <p className="mt-1 text-2xl font-extrabold">{[78, 71, 69][i]}%</p>
              </div>
            ))}
          </div>
          <div className="flex h-28 items-end gap-1.5 rounded-xl border border-borda p-3">
            {barras.map((h, i) => (
              <span key={i} className="flex-1 rounded-t bg-acerto" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      }
    />
  );
}
