import Link from "next/link";

type Props = {
  /** O que foi escolhido ("Direito Penal · Feminicídio; Informática"). Vazio = todas as matérias. */
  texto: string;
  /** Tela de filtro já preenchida com a seleção. */
  trocar: string;
};

/** Mostra o que o aluno escolheu na tela Estudar ("Língua Portuguesa · Substantivo · Médio"). */
export function SelecaoAtual({ texto, trocar }: Props) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-borda bg-superficie px-4 py-3 text-sm">
      <span className="min-w-0 flex-1 font-extrabold leading-snug">{texto || "Todas as matérias"}</span>
      <Link href={trocar} className="-my-2 -mr-2 shrink-0 rounded-lg px-2 py-2 font-bold text-marca-clara hover:underline">
        Trocar
      </Link>
    </div>
  );
}
