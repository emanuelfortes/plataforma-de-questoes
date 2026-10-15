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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-borda bg-white/5 px-4 py-3 text-sm">
      <span className="font-extrabold">{nomes.length ? nomes.join(" · ") : "Todas as matérias"}</span>
      <Link href={trocar} className="ml-auto font-bold text-marca-clara hover:underline">
        Trocar
      </Link>
    </div>
  );
}
