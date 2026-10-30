import { ChevronRight, Lightbulb, ListChecks, MessageCircleQuestion, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { chaveArtigo } from "@/lib/artigos-lei";
import { cn, formatarNumero } from "@/lib/utils";
import type { Explicacao } from "@/lib/explicacao";
import type { AvisoStf, No, Selo } from "@/server/vade-mecum";

/** O que o leitor sabe além do texto: questões por artigo e avisos do STF (as chaves são "121", "5", "121-A"). */
export type Extras = {
  lei: string;
  questoes?: Record<string, number>;
  avisos?: Record<string, AvisoStf>;
  /** Explicações aprovadas pelo professor ("Entender este artigo"). */
  explicacoes?: Record<string, Explicacao>;
};

// Desenha a lei desmontada: cada artigo num cartão, com o nome dele em cima, parágrafos, incisos e alíneas
// recuados e etiquetados, a pena separada e as palavras que a banca troca em destaque.

type Cartao = { rubrica: string | null; artigo: Extract<No, { tipo: "artigo" }>; filhos: No[] };
type Bloco = { tipo: "titulo"; no: Extract<No, { tipo: "titulo" }> } | { tipo: "cartao"; cartao: Cartao } | { tipo: "solto"; no: No };

/** Agrupa a sequência de partes em títulos e cartões de artigo. */
function agrupar(nos: No[]): Bloco[] {
  const blocos: Bloco[] = [];
  // Rubrica ainda sem dono: vira o nome do próximo artigo se ele vier logo em seguida.
  let pendente: string | null = null;
  let atual: Cartao | null = null;
  for (const no of nos) {
    if (no.tipo === "titulo") {
      atual = null;
      pendente = null;
      blocos.push({ tipo: "titulo", no });
    } else if (no.tipo === "artigo") {
      // A rubrica logo antes do artigo é o nome dele: sai do fim do cartão anterior.
      if (pendente && atual?.filhos.at(-1)?.tipo === "rubrica") atual.filhos.pop();
      atual = { rubrica: pendente, artigo: no, filhos: [] };
      pendente = null;
      blocos.push({ tipo: "cartao", cartao: atual });
    } else if (no.tipo === "rubrica") {
      if (atual) atual.filhos.push(no); // subtítulo dentro do artigo ("Homicídio qualificado", antes do § 2º)
      pendente = no.texto;
    } else {
      pendente = null;
      if (atual) atual.filhos.push(no);
      else blocos.push({ tipo: "solto", no });
    }
  }
  return blocos;
}

export function LeituraLei({ nos, extras }: { nos: No[]; extras?: Extras }) {
  return (
    <div className="space-y-4">
      {agrupar(nos).map((b, i) => {
        if (b.tipo === "titulo") return <Titulo key={i} no={b.no} />;
        if (b.tipo === "cartao") return <CartaoArtigo key={b.cartao.artigo.id} cartao={b.cartao} extras={extras} />;
        return b.no.tipo === "texto" ? (
          <p key={i} className="text-[15px] leading-relaxed text-texto/85">
            <Destacar texto={b.no.texto} />
          </p>
        ) : null;
      })}
    </div>
  );
}

function Titulo({ no }: { no: Extract<No, { tipo: "titulo" }> }) {
  return (
    <div className={cn("pt-4 text-center", no.nivel >= 3 && "pt-2")}>
      <p className={cn("font-extrabold uppercase tracking-[.08em] text-destaque", no.nivel <= 2 ? "text-xs" : "text-[11px]")}>{no.rotulo}</p>
      {no.nome && <p className={cn("mt-0.5 font-extrabold uppercase", no.nivel <= 2 ? "text-sm" : "text-xs text-suave")}>{no.nome}</p>}
    </div>
  );
}

function CartaoArtigo({ cartao, extras }: { cartao: Cartao; extras?: Extras }) {
  const { artigo, rubrica, filhos } = cartao;
  const chave = chaveArtigo(artigo.numero);
  const questoes = extras?.questoes?.[chave] ?? 0;
  const aviso = extras?.avisos?.[chave];
  const explicacao = extras?.explicacoes?.[chave];
  return (
    <article id={artigo.id} className="scroll-mt-20 overflow-hidden rounded-2xl border border-borda bg-superficie">
      {rubrica && (
        <p className="border-b border-borda bg-camada px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.06em] text-marca-clara">{rubrica}</p>
      )}
      <div className="space-y-2.5 p-4">
        <p className="text-[16px] leading-[1.7]">
          <span className="mr-2 inline-flex rounded-md bg-marca px-2 py-0.5 align-[1px] text-xs font-extrabold text-sobre-marca">Art. {artigo.numero}</span>
          {artigo.texto ? <Destacar texto={artigo.texto} /> : <Revogado selos={artigo.selos} />}
          <Selos selos={artigo.selos} />
        </p>
        {aviso && (
          <details className="group rounded-lg border border-erro/40 bg-erro-suave">
            <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2 text-[13px] font-bold text-erro [&::-webkit-details-marker]:hidden">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="flex-1">Atenção: {aviso.situacao}</span>
              <span className="text-xs group-open:hidden">ver</span>
            </summary>
            <p className="px-3 pb-3 text-[13px] leading-relaxed text-texto/90">{aviso.nota}</p>
          </details>
        )}
        {filhos.map((n, i) => (
          <Filho key={i} no={n} />
        ))}
      </div>
      {explicacao && <Entender explicacao={explicacao} />}
      {questoes > 0 && extras && (
        <Link
          href={`/questoes?lei=${extras.lei}&art=${encodeURIComponent(chave)}`}
          className="flex items-center gap-2 border-t border-borda bg-marca-suave px-4 py-2.5 text-sm font-bold text-marca-clara transition-colors hover:bg-marca/20"
        >
          <ListChecks className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">
            {formatarNumero(questoes)} {questoes === 1 ? "questão cobra" : "questões cobram"} este artigo
          </span>
          <span className="text-xs">Resolver</span>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </Link>
      )}
    </article>
  );
}

/** O artigo em português simples, aberto quando o aluno pede. O texto da lei, acima, não muda. */
function Entender({ explicacao }: { explicacao: Explicacao }) {
  return (
    <details className="group border-t border-borda">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-bold text-acerto [&::-webkit-details-marker]:hidden">
        <MessageCircleQuestion className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">Entender este artigo</span>
        <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      <div className="space-y-3 bg-acerto-suave px-4 pb-4 pt-1 text-[15px] leading-relaxed">
        <p>{explicacao.sentido}</p>
        {explicacao.pontos.length > 0 && (
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[.06em] text-acerto">O que mais cai</p>
            <ul className="mt-1 space-y-1.5">
              {explicacao.pontos.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-acerto" aria-hidden />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="rounded-lg bg-superficie px-3 py-2 text-[14px]">
          <strong className="text-acerto">Exemplo: </strong>
          {explicacao.exemplo}
        </p>
        {explicacao.pegadinha && (
          <p className="flex gap-2 rounded-lg border border-destaque/40 bg-destaque-suave px-3 py-2 text-[14px]">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-destaque" aria-hidden />
            <span>
              <strong className="text-destaque">Pegadinha: </strong>
              {explicacao.pegadinha}
            </span>
          </p>
        )}
      </div>
    </details>
  );
}

function Filho({ no }: { no: No }) {
  if (no.tipo === "rubrica")
    return <p className="pt-2 text-[11px] font-extrabold uppercase tracking-[.06em] text-marca-clara">{no.texto}</p>;
  if (no.tipo === "pena")
    return (
      <p className="flex gap-2 rounded-lg bg-camada px-3 py-2 text-[13px] text-suave">
        <span className="shrink-0 font-extrabold uppercase tracking-wide">Pena</span>
        <span>
          {no.texto}
          <Selos selos={no.selos} />
        </span>
      </p>
    );
  if (no.tipo === "paragrafo" || no.tipo === "inciso" || no.tipo === "alinea" || no.tipo === "texto") {
    const recuo = no.tipo === "paragrafo" ? "ml-2" : no.tipo === "inciso" ? "ml-5" : no.tipo === "alinea" ? "ml-9" : "ml-5";
    const etiqueta = no.tipo === "texto" ? null : no.numero;
    return (
      <p className={cn("border-l-2 pl-3 text-[15px] leading-[1.7]", recuo, no.tipo === "paragrafo" ? "border-marca/50" : "border-borda")}>
        {etiqueta && (
          <span
            className={cn(
              "mr-1.5 inline-flex rounded px-1.5 align-[1px] text-[11px] font-extrabold",
              no.tipo === "paragrafo" ? "bg-marca-suave text-marca-clara" : "bg-camada-forte text-texto/80",
            )}
          >
            {etiqueta}
          </span>
        )}
        {no.texto ? <Destacar texto={no.texto} /> : <Revogado selos={no.selos} />}
        <Selos selos={no.selos} />
      </p>
    );
  }
  return null;
}

function Revogado({ selos }: { selos: Selo[] }) {
  const r = selos.find((s) => s.tipo === "revogado");
  return <span className="text-sm italic text-suave">Revogado{r?.norma ? ` (${r.norma})` : ""}</span>;
}

/** Selos de atualização. Mudança de 2024 para cá ganha "NOVO": a banca adora lei recém-alterada. */
function Selos({ selos }: { selos: Selo[] }) {
  const visiveis = selos.filter((s) => s.tipo !== "revogado" && s.norma);
  if (!visiveis.length) return null;
  const ANO_NOVO = new Date().getFullYear() - 2;
  return (
    <>
      {visiveis.map((s, i) => {
        const novo = (s.ano ?? 0) >= ANO_NOVO;
        return (
          <span
            key={i}
            className={cn(
              "ml-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-px align-[2px] text-[10px] font-bold",
              novo ? "bg-destaque-suave text-destaque" : "bg-camada text-suave",
            )}
          >
            {novo && <span className="font-extrabold">NOVO ·</span>}
            {s.tipo === "redacao" ? "Redação da" : "Incluído pela"} {s.norma}
          </span>
        );
      })}
    </>
  );
}

// Palavras que mudam o sentido da regra e que a banca troca para fazer a pegadinha.
const PERIGOSAS =
  /\b(salvo|exceto|ressalvad[oa]s?|somente|apenas|exclusivamente|privativ[oa]s?|privativamente|vedad[oa]s?|é vedado|independentemente|dispensad[oa]s?|facultad[oa]s?|poderá|poderão|deverá|deverão|obrigatoriamente|em qualquer caso|em nenhum caso|nunca|sempre|vedada|proibid[oa]s?)\b/gi;

/** Texto com as palavras perigosas sublinhadas. */
export function Destacar({ texto }: { texto: string }): ReactNode {
  const partes = texto.split(PERIGOSAS);
  return partes.map((p, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-sm bg-transparent font-bold text-texto underline decoration-destaque decoration-2 underline-offset-[3px]">
        {p}
      </mark>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}
