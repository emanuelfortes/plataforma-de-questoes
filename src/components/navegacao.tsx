"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/questoes", rotulo: "Questões" },
  { href: "/flashcards", rotulo: "Flashcards" },
  { href: "/desempenho", rotulo: "Desempenho" },
];

export function Navegacao({ nome }: { nome: string }) {
  const caminho = usePathname();
  const router = useRouter();

  async function sair() {
    await authClient.signOut();
    router.push("/entrar");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-borda bg-superficie/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-1 px-4">
        <Link href="/questoes" className="mr-4 font-semibold tracking-tight">
          Questões<span className="text-marca">.</span>
        </Link>
        <nav className="flex gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                caminho.startsWith(l.href)
                  ? "bg-marca-suave font-medium text-marca-forte"
                  : "text-suave hover:text-texto",
              )}
            >
              {l.rotulo}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <Link
            href="/conta"
            className={cn(
              "text-suave hover:text-texto",
              caminho.startsWith("/conta") && "font-medium text-texto",
            )}
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
