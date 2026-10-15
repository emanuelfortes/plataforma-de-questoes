"use client";

import { Flame } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

// "Estudar" fica ativo também durante a resolução (questões e flashcards).
const LINKS = [
  { href: "/estudar", rotulo: "Estudar", ativoEm: ["/estudar", "/questoes", "/flashcards"] },
  { href: "/desempenho", rotulo: "Desempenho", ativoEm: ["/desempenho"] },
];

type Props = {
  nome: string;
  admin?: boolean;
  // Fase 2: passe os valores reais a partir do layout. Enquanto isso, podem ficar undefined.
  streak?: number;
  percentual?: number;
};

export function Navegacao({ nome, admin, streak, percentual }: Props) {
  const caminho = usePathname();
  const router = useRouter();

  async function sair() {
    await authClient.signOut();
    router.push("/entrar");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 bg-fundo/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-6">
        <Link href="/estudar" className="mr-6 flex items-center gap-2.5 font-extrabold">
          <span className="grid size-7 place-items-center rounded-lg bg-marca text-xs text-white">RN</span>
          <span className="text-[15px]">Riccardo Nobrega</span>
        </Link>
        <nav className="flex gap-1">
          {[...LINKS, ...(admin ? [{ href: "/admin", rotulo: "Admin", ativoEm: ["/admin"] }] : [])].map((l) => {
            const ativo = l.ativoEm.some((c) => caminho.startsWith(c));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "border-b-2 px-3.5 py-2 text-sm transition-colors",
                  ativo ? "border-marca font-bold text-texto" : "border-transparent font-semibold text-suave hover:text-texto",
                )}
              >
                {l.rotulo}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          {streak !== undefined && (
            <span className="inline-flex items-center gap-1.5 font-extrabold text-destaque">
              <Flame className="size-4 fill-current" aria-hidden /> {streak} dias
            </span>
          )}
          {percentual !== undefined && <span className="font-bold">{percentual}% acerto</span>}
          <Link
            href="/conta"
            className={cn("font-semibold text-suave hover:text-texto", caminho.startsWith("/conta") && "text-texto")}
          >
            <span className="hidden sm:inline">{nome}</span>
            <span className="sm:hidden">Conta</span>
          </Link>
          <button onClick={sair} className="text-suave hover:text-texto">
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
