import Link from "next/link";

type Props = {
  tipo: "questoes" | "flashcards";
  disciplinaId?: number;
  partes: (string | undefined | null)[];
};

/** Mostra o que o aluno escolheu na tela Estudar ("Língua Portuguesa · Substantivo · Médio"). */
export function SelecaoAtual({ tipo, disciplinaId, partes }: Props) {
  const nomes = partes.filter(Boolean);
  const trocar = disciplinaId ? `/estudar?tipo=${tipo}&disciplina=${disciplinaId}` : `/estudar?tipo=${tipo}`;
  return (
    <div className="flex items-center gap-4 rounded-xl border border-borda bg-white/5 px-4 py-3 text-sm">
      <span className="min-w-0 flex-1 font-extrabold leading-snug">{nomes.length ? nomes.join(" · ") : "Todas as matérias"}</span>
      <Link href={trocar} className="-my-2 -mr-2 shrink-0 rounded-lg px-2 py-2 font-bold text-marca-clara hover:underline">
        Trocar
      </Link>
    </div>
  );
}
