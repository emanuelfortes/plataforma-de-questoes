import type { Metadata } from "next";
import Link from "next/link";
import { SessaoFlashcards } from "@/components/flashcards/sessao-flashcards";
import { lerId } from "@/lib/filtros";
import { exigirUsuario } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import { montarSessao } from "@/server/flashcards";
import { listarDisciplinas } from "@/server/questoes";

export const metadata: Metadata = { title: "Flashcards" };

type Params = Promise<{ [chave: string]: string | string[] | undefined }>;

export default async function PaginaFlashcards({ searchParams }: { searchParams: Params }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const disciplinaId = lerId(typeof sp.disciplina === "string" ? sp.disciplina : undefined);

  const [disciplinas, cards] = await Promise.all([
    listarDisciplinas(),
    montarSessao(usuario.id, disciplinaId),
  ]);

  const chip = (ativo: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-sm transition-colors",
      ativo
        ? "border-marca bg-marca-suave font-medium text-marca-forte"
        : "border-borda bg-superficie hover:bg-fundo",
    );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Flashcards</h1>
        <p className="mt-1 text-sm text-suave">
          Revisões vencidas primeiro, depois cards novos. O intervalo de cada card se ajusta à sua
          resposta.
        </p>
      </div>

      <nav aria-label="Disciplina" className="flex flex-wrap gap-2">
        <Link href="/flashcards" className={chip(!disciplinaId)}>
          Todas
        </Link>
        {disciplinas.map((d) => (
          <Link key={d.id} href={`/flashcards?disciplina=${d.id}`} className={chip(disciplinaId === d.id)}>
            {d.nome}
          </Link>
        ))}
      </nav>

      {/* key força reiniciar a sessão ao trocar de disciplina */}
      <SessaoFlashcards key={disciplinaId ?? "todas"} cards={cards} />
    </div>
  );
}
