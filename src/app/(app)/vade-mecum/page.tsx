import { BookMarked, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { VadeMecumBloqueado } from "@/components/vade-mecum/bloqueado";
import { exigirUsuario } from "@/lib/sessao";
import { temAcessoCompleto } from "@/server/assinatura";
import { listarLeis } from "@/server/vade-mecum";

export const metadata: Metadata = { title: "Vade Mecum" };

// Agrupamento da lista (o resto vai para "Outras leis").
const GRUPOS: { titulo: string; ids: string[] }[] = [
  { titulo: "Constituição e códigos", ids: ["cf88", "cp", "cpp", "cpm", "cppm", "lei-9503-1997"] },
];

export default async function PaginaVadeMecum() {
  const usuario = await exigirUsuario();
  if (!(await temAcessoCompleto(usuario))) return <VadeMecumBloqueado />;
  const leis = await listarLeis();
  const principais = new Set(GRUPOS.flatMap((g) => g.ids));
  const grupos = [
    ...GRUPOS.map((g) => ({ titulo: g.titulo, leis: g.ids.map((id) => leis.find((l) => l.id === id)).filter((l) => !!l) })),
    { titulo: "Leis especiais", leis: leis.filter((l) => !principais.has(l.id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[.06em] text-destaque">
          <BookMarked className="size-4" aria-hidden /> Vade Mecum
        </p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-[1.1] tracking-[-.03em] sm:text-[34px]">A lei, do jeito certo de ler</h1>
        <p className="mt-2 text-sm text-suave">
          Texto atualizado do Planalto, com cada artigo desmontado: parágrafos, incisos e pena separados, as palavras que a banca troca em
          destaque e o aviso de cada mudança recente.
        </p>
      </div>
      {grupos.map((g) => (
        <section key={g.titulo} className="space-y-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[.06em] text-suave">{g.titulo}</h2>
          <ul className="overflow-hidden rounded-2xl border border-borda bg-superficie">
            {g.leis.map((l) => (
              <li key={l.id} className="border-t border-borda first:border-t-0">
                <Link href={`/vade-mecum/${l.id}`} className="flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors hover:bg-camada">
                  <span className="min-w-0 flex-1">{l.nome}</span>
                  <ChevronRight className="size-4 shrink-0 text-suave" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
