import type { Metadata } from "next";
import { GeradorPrompt } from "@/components/admin/gerador-prompt";
import { Importador } from "@/components/admin/importador";
import { Card } from "@/components/ui/card";
import { exigirAdmin } from "@/lib/sessao";
import { formatarNumero } from "@/lib/utils";
import { detalharMateria, listarMaterias } from "@/server/estudar";

export const metadata: Metadata = { title: "Área do dono" };

function Passo({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-5 border-borda bg-white/5 p-6">
      <h2 className="flex items-center gap-3 text-lg font-extrabold">
        <span className="grid size-8 place-items-center rounded-lg bg-marca text-sm text-white">{numero}</span>
        {titulo}
      </h2>
      {children}
    </Card>
  );
}

export default async function PaginaAdmin() {
  await exigirAdmin();

  // Cobertura atual por matéria (tudo sai de "contagens"). As matérias nascem das importações.
  const [comQuestoes, comFlashcards] = await Promise.all([listarMaterias("questoes"), listarMaterias("flashcards")]);
  const ids = new Map([...comQuestoes, ...comFlashcards].map((d) => [d.id, d.nome]));
  const cobertura = (
    await Promise.all(
      [...ids].map(async ([id, nome]) => {
        const [q, f] = await Promise.all([detalharMateria("questoes", id), detalharMateria("flashcards", id)]);
        const areas = [...new Set([...(q?.areas ?? []), ...(f?.areas ?? [])].map((x) => x.nome))].sort((x, y) =>
          x.localeCompare(y, "pt-BR"),
        );
        return { nome, questoes: q?.total ?? 0, flashcards: f?.total ?? 0, areas };
      }),
    )
  ).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">Área do dono</p>
        <h1 className="mt-1 text-[34px] font-extrabold leading-[1.1] tracking-[-.03em]">Alimentar a plataforma</h1>
        <p className="mt-2 text-sm text-suave">
          Gere o prompt, mande para a IA junto com o PDF e importe o arquivo que ela devolver.
        </p>
      </div>

      <Passo numero={1} titulo="Gerar o prompt">
        <GeradorPrompt existentes={cobertura.map((c) => ({ nome: c.nome, areas: c.areas }))} />
      </Passo>

      <Passo numero={2} titulo="Mandar para a IA">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-texto/85">
          <li>Abra uma conversa nova no Claude, ChatGPT ou Gemini.</li>
          <li>Anexe o PDF (se for grande, um capítulo por vez).</li>
          <li>Cole o prompt copiado no passo 1 e envie.</li>
          <li>Baixe o arquivo .json que ela gerar. Se ela responder em texto, copie o bloco de código.</li>
          <li>Para mais questões do mesmo PDF, na mesma conversa: &quot;Gere outro lote no mesmo formato, priorizando os pontos com menos questões, sem repetir as anteriores&quot;.</li>
        </ol>
      </Passo>

      <Passo numero={3} titulo="Importar o arquivo">
        <Importador />
        <p className="text-xs text-suave">
          A IA erra às vezes. Depois de importar, resolva algumas questões de cada lote para conferir os gabaritos.
        </p>
      </Passo>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">O que já tem na plataforma</h2>
        <div className="overflow-x-auto rounded-xl border border-borda">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs text-suave">
              <tr>
                <th className="px-4 py-2.5 font-bold">Matéria</th>
                <th className="px-3 font-bold">Questões</th>
                <th className="px-3 font-bold">Flashcards</th>
                <th className="px-3 font-bold">Áreas</th>
              </tr>
            </thead>
            <tbody>
              {cobertura.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-suave">
                    Nada importado ainda. As matérias aparecem aqui depois da primeira importação.
                  </td>
                </tr>
              )}
              {cobertura.map((c) => (
                <tr key={c.nome} className="border-t border-borda">
                  <td className="px-4 py-2.5 font-semibold">{c.nome}</td>
                  <td className="px-3 tabular-nums">{formatarNumero(c.questoes)}</td>
                  <td className="px-3 tabular-nums">{formatarNumero(c.flashcards)}</td>
                  <td className="px-3 py-2.5 text-xs text-suave">{c.areas.join(", ") || "(sem área)"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
