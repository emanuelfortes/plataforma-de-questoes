"use client";

import { BookOpenCheck, ClipboardCheck, LayoutDashboard, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITENS = [
  { href: "/admin", rotulo: "Visão geral", Icone: LayoutDashboard, exato: true },
  { href: "/admin/financeiro", rotulo: "Financeiro", Icone: Wallet },
  { href: "/admin/pessoas", rotulo: "Pessoas", Icone: Users },
  { href: "/admin/questoes", rotulo: "Questões", Icone: BookOpenCheck },
  { href: "/admin/revisao", rotulo: "Revisão", Icone: ClipboardCheck },
];

/** Menu da área do dono: lateral no computador, abas roláveis no celular. */
export function MenuAdmin() {
  const caminho = usePathname();
  return (
    <nav
      aria-label="Área do dono"
      className="-mx-1 flex gap-1 overflow-x-auto pb-1 md:sticky md:top-24 md:mx-0 md:flex-col md:overflow-visible md:pb-0"
    >
      <p className="hidden px-3 pb-2 text-[10px] font-bold uppercase tracking-[1.2px] text-suave md:block">
        Área do dono
      </p>
      {ITENS.map(({ href, rotulo, Icone, exato }) => {
        const ativo = exato ? caminho === href : caminho.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors",
              ativo ? "bg-marca text-sobre-marca" : "text-suave hover:bg-camada hover:text-texto",
            )}
          >
            <Icone className="size-4" aria-hidden />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
