import { GraduationCap } from "lucide-react";

/** Guia curto de leitura da lei, sempre à mão no topo do Vade Mecum. Ensina a anatomia do artigo. */
export function ComoLer() {
  const itens: { marca: React.ReactNode; texto: React.ReactNode }[] = [
    {
      marca: <span className="rounded-md bg-marca px-2 py-0.5 text-xs font-extrabold text-sobre-marca">Art.</span>,
      texto: <><strong>Caput</strong>: a cabeça do artigo, a regra principal. O resto do artigo detalha ou excepciona o caput.</>,
    },
    {
      marca: <span className="rounded bg-marca-suave px-1.5 text-[11px] font-extrabold text-marca-clara">§ 1º</span>,
      texto: <><strong>Parágrafo</strong>: complementa ou abre exceção à regra do caput. Exceção é o que a banca mais cobra.</>,
    },
    {
      marca: <span className="rounded bg-camada-forte px-1.5 text-[11px] font-extrabold">I</span>,
      texto: <><strong>Inciso</strong> (números romanos): lista hipóteses. Cada inciso vale sozinho; um a mais ou a menos muda a resposta.</>,
    },
    {
      marca: <span className="rounded bg-camada-forte px-1.5 text-[11px] font-extrabold">a)</span>,
      texto: <><strong>Alínea</strong>: detalha um inciso.</>,
    },
    {
      marca: <span className="rounded bg-camada px-1.5 text-[11px] font-extrabold uppercase text-suave">Pena</span>,
      texto: <>A pena fica separada e discreta: a prova cobra muito mais o crime do que a quantidade de pena.</>,
    },
    {
      marca: <span className="font-bold underline decoration-destaque decoration-2 underline-offset-[3px]">salvo</span>,
      texto: <>Palavras sublinhadas (<em>salvo, somente, vedado, poderá, deverá...</em>) mudam o sentido da regra. São as que a banca troca.</>,
    },
    {
      marca: <span className="rounded bg-destaque-suave px-1.5 text-[10px] font-extrabold text-destaque">NOVO</span>,
      texto: <>Mudança recente na lei. Banca adora cobrar o que acabou de mudar.</>,
    },
  ];
  return (
    <details className="group rounded-xl border border-borda bg-superficie">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
        <GraduationCap className="size-4 text-destaque" aria-hidden />
        <span className="flex-1">Como ler um artigo</span>
        <span className="text-xs text-marca-clara group-open:hidden">1 minuto</span>
      </summary>
      <ul className="space-y-3 border-t border-borda px-4 py-4">
        {itens.map((it, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
            <span className="mt-0.5 w-14 shrink-0 text-center">{it.marca}</span>
            <span className="text-texto/85">{it.texto}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
