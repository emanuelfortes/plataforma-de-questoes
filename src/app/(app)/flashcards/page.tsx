import type { Metadata } from "next";
import { SessaoFlashcards } from "@/components/flashcards/sessao-flashcards";
import { SelecaoAtual } from "@/components/selecao-atual";
import { lerId } from "@/lib/filtros";
import { exigirUsuario } from "@/lib/sessao";
import { nomesSelecao } from "@/server/estudar";
import { montarSessao } from "@/server/flashcards";

export const metadata: Metadata = { title: "Flashcards" };

type Params = Promise<{ [chave: string]: string | string[] | undefined }>;

export default async function PaginaFlashcards({ searchParams }: { searchParams: Params }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const texto = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const disciplinaId = lerId(texto("disciplina"));
  const assuntoId = disciplinaId ? lerId(texto("assunto")) : undefined;

  const [nomes, cards] = await Promise.all([
    nomesSelecao(disciplinaId, assuntoId),
    montarSessao(usuario.id, disciplinaId, assuntoId),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">Flashcards</p>
        <h1 className="mt-1 text-[34px] font-extrabold leading-[1.1] tracking-[-.03em]">Revisão do dia</h1>
        <p className="mt-2 text-sm text-suave">
          Revisões vencidas primeiro, depois cards novos. O intervalo de cada card se ajusta à sua resposta.
        </p>
      </div>

      <SelecaoAtual tipo="flashcards" disciplinaId={disciplinaId} partes={[nomes.disciplina, nomes.assunto]} />

      {/* key força reiniciar a sessão ao trocar a seleção */}
      <SessaoFlashcards key={`${disciplinaId ?? "todas"}-${assuntoId ?? "todas"}`} cards={cards} />
    </div>
  );
}
