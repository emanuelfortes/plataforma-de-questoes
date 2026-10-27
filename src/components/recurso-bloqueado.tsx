import { Lock } from "lucide-react";
import Link from "next/link";
import { variantesBotao } from "@/components/ui/button";

type Props = {
  titulo: string;
  descricao: string;
  /** O que o assinante ganha, em itens curtos. */
  beneficios: string[];
  /** Prévia do recurso (fica desfocada atrás do cadeado). Só ilustração: nada de dado real do banco. */
  previa: React.ReactNode;
};

/**
 * Recurso só para assinantes (flashcards, desempenho): o aluno grátis vê como é, desfocado e com cadeado,
 * e o botão para assinar. Vê que existe e quanto vale, em vez de não saber que existe.
 */
export function RecursoBloqueado({ titulo, descricao, beneficios, previa }: Props) {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[.06em] text-destaque">
          <Lock className="size-3.5" aria-hidden /> Só assinantes
        </p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-[1.1] tracking-[-.03em] sm:text-[34px]">{titulo}</h1>
        <p className="mt-2 text-sm text-suave">{descricao}</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-borda">
        <div className="pointer-events-none select-none blur-[3px]" aria-hidden inert>
          {previa}
        </div>
        <div className="absolute inset-0 grid place-items-center bg-fundo/40">
          <span className="grid size-16 place-items-center rounded-full border border-borda bg-superficie shadow-lg">
            <Lock className="size-7 text-destaque" aria-hidden />
          </span>
        </div>
      </div>

      <ul className="space-y-2">
        {beneficios.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-destaque" aria-hidden />
            {b}
          </li>
        ))}
      </ul>

      <Link href="/assinatura" className={variantesBotao({ tamanho: "grande", className: "w-full" })}>
        Assinar para liberar
      </Link>
    </div>
  );
}
