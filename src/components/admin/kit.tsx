import Link from "next/link";
import { cn } from "@/lib/utils";

// Blocos visuais da área do dono (mesma organização do painel do LexCursos):
// cabeçalho de página, card de métrica, card de seção e selo de situação.

export function CabecalhoPagina({
  titulo,
  subtitulo,
  acoes,
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-.02em]">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-suave">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function CardMetrica({
  rotulo,
  valor,
  dica,
  tom = "normal",
  destaque = false,
}: {
  rotulo: string;
  valor: React.ReactNode;
  dica?: React.ReactNode;
  tom?: "normal" | "acerto" | "erro" | "destaque";
  destaque?: boolean;
}) {
  const corDica = { normal: "text-suave", acerto: "text-acerto", erro: "text-erro", destaque: "text-destaque" }[tom];
  return (
    <div className={cn("rounded-2xl border p-4", destaque ? "border-marca bg-marca-suave" : "border-borda bg-white/5")}>
      <p className="text-[13px] text-suave">{rotulo}</p>
      <p className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-tight tabular-nums">{valor}</p>
      {dica && <p className={cn("mt-1 text-xs font-semibold", corDica)}>{dica}</p>}
    </div>
  );
}

export function Secao({
  titulo,
  acao,
  children,
  className,
}: {
  titulo?: React.ReactNode;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-borda bg-white/5", className)}>
      {(titulo || acao) && (
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
          {titulo && <h2 className="text-sm font-extrabold">{titulo}</h2>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

const SELO = {
  acerto: "bg-acerto-suave text-acerto",
  marca: "bg-marca-suave text-marca-clara",
  destaque: "bg-destaque-suave text-destaque",
  erro: "bg-erro-suave text-erro",
  neutro: "bg-white/10 text-suave",
} as const;

export function Selo({ tom = "neutro", children }: { tom?: keyof typeof SELO; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", SELO[tom])}>
      {children}
    </span>
  );
}

export function LinkBotao({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-borda px-3.5 text-[13px] font-bold transition-colors hover:bg-white/10",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Cabeçalho de tabela (rótulo em caixa alta, como no painel do Lex). */
export const classeCabecalhoTabela = "text-[10px] font-bold uppercase tracking-[1.2px] text-suave";
