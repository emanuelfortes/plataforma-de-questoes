import { Lightbulb, Scale, TriangleAlert } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { separarComentario, type ItemAlternativa } from "@/lib/comentario";
import { cn } from "@/lib/utils";

type Props = {
  comentario: string;
  gabarito: string;
  /** Letra que o aluno marcou. */
  escolhida: string | null;
};

/**
 * Comentário da questão em partes, como no TEC: a explicação, cada alternativa no seu bloco,
 * a letra da lei separada e os avisos (pegadinha, macete). Sem rótulos no texto, mostra o texto corrido.
 */
export function ComentarioQuestao({ comentario, gabarito, escolhida }: Props) {
  const partes = separarComentario(comentario);
  return (
    <div className="space-y-5">
      {partes.map((p, i) => {
        if (p.tipo === "texto")
          return (
            <section key={i}>
              {i === 0 && <Titulo>Comentário</Titulo>}
              <Paragrafos texto={p.texto} className="text-texto/90" />
            </section>
          );
        if (p.tipo === "alternativas")
          return (
            <section key={i}>
              <Titulo>Alternativa por alternativa</Titulo>
              <ul className="mt-2 overflow-hidden rounded-xl border border-borda">
                {p.itens.map((it) => (
                  <Alternativa key={it.letra} item={it} gabarito={gabarito} escolhida={escolhida} />
                ))}
              </ul>
            </section>
          );
        if (p.tipo === "lei")
          return (
            <section key={i} className="rounded-xl border border-borda bg-camada p-4">
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.06em] text-marca-clara">
                <Scale className="size-4" aria-hidden /> {p.rotulo}
              </p>
              <Paragrafos texto={p.texto} className="mt-2 border-l-2 border-marca pl-3 text-[14px] text-texto/85" />
            </section>
          );
        if (p.tipo === "aviso") {
          const Icone = /macete|fique/i.test(p.rotulo) ? Lightbulb : TriangleAlert;
          return (
            <section key={i} className="rounded-xl border border-destaque/40 bg-destaque-suave p-4">
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.06em] text-destaque">
                <Icone className="size-4" aria-hidden /> {p.rotulo}
              </p>
              <Paragrafos texto={p.texto} className="mt-1.5 text-[14px] text-texto/90" />
            </section>
          );
        }
        return (
          <p key={i} className="text-xs text-suave">
            <strong className="font-bold">{p.rotulo}:</strong> {formatar(p.texto)}
          </p>
        );
      })}
    </div>
  );
}

function Titulo({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-extrabold uppercase tracking-[.06em] text-marca-clara">{children}</h2>;
}

function Alternativa({ item, gabarito, escolhida }: { item: ItemAlternativa; gabarito: string; escolhida: string | null }) {
  // A cor vem do gabarito (o texto do comentário pode não dizer "Correta"/"Errada").
  const correta = item.letra === gabarito;
  const sua = item.letra === escolhida;
  const linhas = item.texto.split("\n").map((l) => l.trim()).filter(Boolean);
  // Estilo TEC: "» " repete o item (em itálico, com o erro riscado) e "> " traz a letra da lei para comparar.
  const repetido = linhas.find((l) => l.startsWith("» "));
  return (
    <li className={cn("flex gap-3 border-t border-borda p-3 first:border-t-0", correta && "bg-acerto-suave")}>
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold",
          correta ? "bg-acerto text-fundo" : "bg-erro-suave text-erro",
        )}
        aria-label={`Alternativa ${item.letra}, ${correta ? "correta" : "errada"}`}
      >
        {item.letra}
      </span>
      <div className="min-w-0 flex-1 text-[14px] leading-relaxed">
        {(!repetido || sua) && (
          <p className="flex flex-wrap items-center gap-x-2 text-xs font-extrabold">
            {!repetido && <span className={correta ? "text-acerto" : "text-erro"}>{correta ? "Correta" : "Errada"}</span>}
            {sua && <span className="rounded bg-marca-suave px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-marca-clara">Sua resposta</span>}
          </p>
        )}
        <div className="mt-1 space-y-2.5">
          {repetido && (
            <p className="italic text-texto/90">
              {formatar(repetido.slice(2))}{" "}
              <strong className={cn("not-italic font-extrabold", correta ? "text-acerto" : "text-erro")}>{correta ? "CORRETA" : "INCORRETA"}.</strong>
            </p>
          )}
          {linhas
            .filter((l) => l !== repetido)
            .map((l, i) =>
              l.startsWith("> ") ? (
                <blockquote key={i} className="border-l-[3px] border-borda-forte pl-3 italic text-texto/85">
                  {formatar(l.slice(2))}
                </blockquote>
              ) : (
                <p key={i} className="text-texto/90">
                  {formatar(l)}
                </p>
              ),
            )}
        </div>
      </div>
    </li>
  );
}

function Paragrafos({ texto, className }: { texto: string; className?: string }) {
  return (
    <div className={cn("mt-2 space-y-2 text-[15px] leading-[1.7]", className)}>
      {texto.split(/\n\s*\n/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {formatar(p)}
        </p>
      ))}
    </div>
  );
}

/**
 * Marcações simples no texto do comentário: ~~trecho~~ aparece riscado em vermelho (a palavra que deixa a
 * alternativa errada, como no TEC), ==trecho== em vermelho forte (a palavra da lei que decide) e **trecho** em
 * negrito. O resto é texto puro (nada de HTML).
 */
function formatar(texto: string): ReactNode {
  const pedacos = texto.split(/(~~[^~]+~~|==[^=]+==|\*\*[^*]+\*\*)/g);
  return pedacos.map((p, i) => {
    if (p.startsWith("~~") && p.endsWith("~~"))
      return (
        <s key={i} className="text-erro decoration-2">
          {p.slice(2, -2)}
        </s>
      );
    if (p.startsWith("==") && p.endsWith("==") && p.length > 4)
      return (
        <strong key={i} className="font-extrabold not-italic text-erro">
          {p.slice(2, -2)}
        </strong>
      );
    if (p.startsWith("**") && p.endsWith("**"))
      return (
        <strong key={i} className="font-extrabold">
          {p.slice(2, -2)}
        </strong>
      );
    return <Fragment key={i}>{p}</Fragment>;
  });
}
