import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

export type Etiqueta = { chave: string; rotulo: string; /** Endereço da mesma lista sem este filtro. */ sem: string };

type Props = {
  etiquetas: Etiqueta[];
  /** Tela de filtro já preenchida com tudo o que está aplicado. */
  editar: string;
  /** Sem nenhum filtro (null quando já não há nenhum). */
  limpar: string | null;
};

/** Mostra quantas etiquetas antes de recolher o resto em "+N" (ex.: "Todo o conteúdo" de um título do CP). */
const VISIVEIS = 6;

/**
 * Filtros aplicados, como no TEC: cada um vira uma etiqueta com X para tirar só ele.
 * Só links (funciona sem JavaScript); o status (Não resolvidas, Acertei...) fica nos botões logo abaixo.
 */
export function FiltrosAplicados({ etiquetas, editar, limpar }: Props) {
  const primeiras = etiquetas.slice(0, VISIVEIS);
  const resto = etiquetas.slice(VISIVEIS);
  return (
    <section aria-label="Filtros aplicados" className="rounded-xl border border-borda bg-superficie px-4 py-3">
      <div className="flex items-center gap-3">
        <h2 className="flex-1 text-[11px] font-bold uppercase tracking-[.06em] text-suave">Filtros aplicados</h2>
        {limpar && (
          <Link href={limpar} className="-my-1 rounded-lg px-2 py-1 text-xs font-bold text-suave hover:text-texto">
            Limpar
          </Link>
        )}
        <Link
          href={editar}
          className="-my-1 -mr-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-bold text-marca-clara hover:underline"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Editar
        </Link>
      </div>

      {etiquetas.length === 0 ? (
        <p className="mt-2 text-sm font-extrabold">Todas as matérias</p>
      ) : (
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {primeiras.map((e) => (
            <EtiquetaFiltro key={e.chave} etiqueta={e} />
          ))}
          {resto.length > 0 && (
            // Aberto, ocupa a linha inteira e mostra as demais etiquetas embaixo.
            <li className="has-[details[open]]:basis-full">
              <details className="group">
                <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-full border border-borda bg-camada px-3 text-xs font-bold text-suave hover:text-texto [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">+{resto.length}</span>
                  <span className="hidden group-open:inline">Mostrar menos</span>
                </summary>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {resto.map((e) => (
                    <EtiquetaFiltro key={e.chave} etiqueta={e} />
                  ))}
                </ul>
              </details>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function EtiquetaFiltro({ etiqueta }: { etiqueta: Etiqueta }) {
  return (
    <li className="inline-flex h-8 max-w-full items-center gap-1 rounded-full border border-marca/40 bg-marca-suave pl-3 text-xs font-bold">
      <span className="truncate">{etiqueta.rotulo}</span>
      <Link
        href={etiqueta.sem}
        aria-label={`Tirar o filtro ${etiqueta.rotulo}`}
        title="Tirar este filtro"
        className="grid size-8 shrink-0 place-items-center rounded-full text-suave hover:text-texto"
      >
        <X className="size-3.5" strokeWidth={3} aria-hidden />
      </Link>
    </li>
  );
}
