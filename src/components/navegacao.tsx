"use client";

import { ChartColumn, Flame, GraduationCap, LogOut, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type ItemNav = { href: string; rotulo: string; Icone: LucideIcon; ativoEm: string[] };

// "Estudar" fica ativo também durante a resolução (questões e flashcards).
const LINKS: ItemNav[] = [
  { href: "/estudar", rotulo: "Estudar", Icone: GraduationCap, ativoEm: ["/estudar", "/questoes", "/flashcards"] },
  { href: "/desempenho", rotulo: "Desempenho", Icone: ChartColumn, ativoEm: ["/desempenho"] },
];
const ADMIN: ItemNav = { href: "/admin", rotulo: "Admin", Icone: ShieldCheck, ativoEm: ["/admin"] };
const CONTA: ItemNav = { href: "/conta", rotulo: "Minha conta", Icone: UserRound, ativoEm: ["/conta"] };

type Props = {
  nome: string;
  admin?: boolean;
  // Fase 2: passe os valores reais a partir do layout. Enquanto isso, podem ficar undefined.
  streak?: number;
  percentual?: number;
};

function Marca() {
  return (
    <Link href="/estudar" className="flex min-w-0 items-center gap-2.5 font-extrabold">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-marca text-xs text-white">RN</span>
      <span className="truncate text-[15px]">Riccardo Nobrega</span>
    </Link>
  );
}

/**
 * Computador: cabeçalho com os links escritos.
 * Celular: barra fina no topo e abas com ícones fixas embaixo, como app.
 */
export function Navegacao({ nome, admin, streak, percentual }: Props) {
  const caminho = usePathname();
  const router = useRouter();
  const links = admin ? [...LINKS, ADMIN] : LINKS;
  const ativo = (l: ItemNav) => l.ativoEm.some((c) => caminho.startsWith(c));
  // Na resolução de questões o rodapé é da barra de ações (Responder, Próxima); as abas saem para dar espaço.
  const semAbas = caminho.startsWith("/questoes");

  async function sair() {
    await authClient.signOut();
    router.push("/entrar");
    router.refresh();
  }

  const indicadores = (
    <>
      {streak !== undefined && (
        <span className="inline-flex items-center gap-1.5 font-extrabold text-destaque">
          <Flame className="size-4 fill-current" aria-hidden /> {streak} dias
        </span>
      )}
      {percentual !== undefined && <span className="font-bold">{percentual}% acerto</span>}
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-20 bg-fundo">
        {/* Computador */}
        <div className="mx-auto hidden h-16 max-w-5xl items-center gap-2 px-6 md:flex">
          <div className="mr-6">
            <Marca />
          </div>
          <nav className="flex gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "border-b-2 px-3.5 py-2 text-sm transition-colors",
                  ativo(l) ? "border-marca font-bold text-texto" : "border-transparent font-semibold text-suave hover:text-texto",
                )}
              >
                {l.rotulo}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm">
            {indicadores}
            <Link
              href="/conta"
              className={cn("max-w-48 truncate font-semibold text-suave hover:text-texto", ativo(CONTA) && "text-texto")}
            >
              {nome}
            </Link>
            <button onClick={sair} className="text-suave hover:text-texto">
              Sair
            </button>
          </div>
        </div>

        {/* Celular */}
        <div className="flex h-14 items-center gap-3 border-b border-borda px-5 md:hidden">
          <Marca />
          <div className="ml-auto flex shrink-0 items-center gap-3 text-sm">
            {indicadores}
            <button
              onClick={sair}
              aria-label="Sair"
              title="Sair"
              className="-mr-2 grid size-10 place-items-center rounded-xl text-suave hover:text-texto"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {!semAbas && (
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-fundo pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="mx-auto flex max-w-md">
            {[...links, CONTA].map((l) => {
              const atual = ativo(l);
              return (
                <li key={l.href} className="flex-1">
                  <Link
                    href={l.href}
                    aria-label={l.rotulo}
                    aria-current={atual ? "page" : undefined}
                    title={l.rotulo}
                    className={cn(
                      "flex h-16 items-center justify-center transition-colors",
                      atual ? "text-marca-clara" : "text-suave hover:text-texto",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-9 w-14 place-items-center rounded-full transition-colors",
                      atual && "bg-marca-suave",
                    )}
                  >
                    <l.Icone className="size-6" strokeWidth={atual ? 2.4 : 2} aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      )}
    </>
  );
}
