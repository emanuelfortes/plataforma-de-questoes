import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

export type Etiqueta = {
  chave: string;
  /** De que é o filtro ("Direito Penal", "Dificuldade", "Tipo de questão"). */
  grupo: string;
  rotulo: string;
  /** Endereço da mesma lista sem este filtro. */
  sem: string;
};

type Props = {
  etiquetas: Etiqueta[];
  /** Tela de filtro já preenchida com tudo o que está aplicado. */
  editar: string;
  /** Sem nenhum filtro (null quando já não há nenhum). */
  limpar: string | null;
};

/** Linhas visíveis antes de recolher o resto em "Ver todos" (a questão não pode ficar lá embaixo). */
const VISIVEIS = 4;

/**
 * Filtros aplicados, um embaixo do outro, cada um com X para tirar só ele (como no TEC).
 * Só links (funciona sem JavaScript); o status (Não resolvidas, Acertei...) fica nos botões logo abaixo.
 */
export function FiltrosAplicados({ etiquetas, editar, limpar }: Props) {
  const primeiras = etiquetas.slice(0, VISIVEIS);
  const resto = etiquetas.slice(VISIVEIS);
  return (
    <section aria-label="Filtros aplicados" className="rounded-xl border border-borda bg-superficie">
      <div className="flex items-center gap-3 border-b border-borda px-4 py-2.5">
        <h2 className="flex-1 text-[11px] font-bold uppercase tracking-[.06em] text-suave">
          Filtros aplicados{etiquetas.length > 0 && ` (${etiquetas.length})`}
        </h2>
        {limpar && (
          <Link href={limpar} className="rounded-lg px-2 py-1 text-xs font-bold text-suave hover:text-texto">
            Limpar
          </Link>
        )}
        <Link
          href={editar}
          className="-mr-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-bold text-marca-clara hover:underline"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Editar
        </Link>
      </div>

      {etiquetas.length === 0 ? (
        <p className="px-4 py-3 text-sm font-extrabold">Todas as matérias</p>
      ) : (
        <>
          <ul>
            {primeiras.map((e) => (
              <LinhaFiltro key={e.chave} etiqueta={e} />
            ))}
          </ul>
          {resto.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none border-t border-borda px-4 py-2.5 text-center text-xs font-bold text-marca-clara [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Ver todos ({etiquetas.length})</span>
                <span className="hidden group-open:inline">Mostrar menos</span>
              </summary>
              <ul>
                {resto.map((e) => (
                  <LinhaFiltro key={e.chave} etiqueta={e} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function LinhaFiltro({ etiqueta }: { etiqueta: Etiqueta }) {
  return (
    <li className="flex items-center gap-3 border-t border-borda py-1.5 pl-4 pr-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold text-suave">{etiqueta.grupo}</p>
        <p className="text-sm font-bold leading-snug">{etiqueta.rotulo}</p>
      </div>
      <Link
        href={etiqueta.sem}
        aria-label={`Tirar o filtro ${etiqueta.rotulo}`}
        title="Tirar este filtro"
        className="grid size-10 shrink-0 place-items-center rounded-lg text-suave hover:bg-camada hover:text-erro"
      >
        <X className="size-4" strokeWidth={2.5} aria-hidden />
      </Link>
    </li>
  );
}
