import { randomInt } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { Filtros } from "@/components/questoes/filtros";
import { Resolucao } from "@/components/questoes/resolucao";
import { SelecaoAtual } from "@/components/selecao-atual";
import { lerFiltroStatus, lerId, lerIds } from "@/lib/filtros";
import { LIMITE_GRATIS_DIA } from "@/lib/planos";
import { exigirUsuario } from "@/lib/sessao";
import { formatarNumero } from "@/lib/utils";
import { situacaoDoAluno } from "@/server/assinatura";
import { nomesSelecao } from "@/server/estudar";
import { contarPorStatus, listarQuestoes, TAMANHO_PAGINA, type CursorQuestoes } from "@/server/questoes";

export const metadata: Metadata = { title: "Questões" };

type Params = Promise<{ [chave: string]: string | string[] | undefined }>;

// Fase 2: trocar por valores reais (ver README). Meta fixa por enquanto.
const META_DIARIA = 30;

// Cursor na URL: "ordem.id" (posição na ordem embaralhada).
function lerCursor(valor: string | undefined): CursorQuestoes | undefined {
  const [ordem, id] = (valor ?? "").split(".").map(Number);
  return Number.isInteger(ordem) && ordem! >= 0 && Number.isInteger(id) && id! > 0
    ? { ordem: ordem!, id: id! }
    : undefined;
}

export default async function PaginaQuestoes({ searchParams }: { searchParams: Params }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const texto = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const disciplinaId = lerId(texto("disciplina"));
  const assuntoIds = disciplinaId ? lerIds(sp.assunto) : [];
  const status = lerFiltroStatus(texto("status"));
  // Ponto de partida sorteado a cada sessão nova; as páginas seguintes levam o mesmo na URL.
  const inicioUrl = Number(texto("inicio"));
  const inicio = Number.isInteger(inicioUrl) && inicioUrl >= 0 ? inicioUrl : randomInt(2 ** 31);
  const cursor = lerCursor(texto("cursor"));
  const voltou = texto("volta") === "1";
  const pagina = Math.max(1, lerId(texto("pagina")) ?? 1);

  const [situacao, nomes, contagens, { questoes, proximo }] = await Promise.all([
    situacaoDoAluno(usuario),
    nomesSelecao(disciplinaId, assuntoIds),
    contarPorStatus({ usuarioId: usuario.id, disciplinaId, assuntoIds }),
    listarQuestoes({ usuarioId: usuario.id, disciplinaId, assuntoIds, status, inicio, cursor, voltou }),
  ]);

  const proximaUrl = (() => {
    if (!proximo) return null;
    const p = new URLSearchParams();
    if (disciplinaId) p.set("disciplina", String(disciplinaId));
    for (const id of assuntoIds) p.append("assunto", String(id));
    if (status !== "todas") p.set("status", status);
    p.set("inicio", String(inicio));
    p.set("cursor", `${proximo.cursor.ordem}.${proximo.cursor.id}`);
    if (proximo.voltou) p.set("volta", "1");
    p.set("pagina", String(pagina + 1));
    return `/questoes?${p.toString()}`;
  })();

  const feitasHoje = 0; // Fase 2
  const faltam = Math.max(0, META_DIARIA - feitasHoje);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Contexto compacto: a questão é o foco da tela. */}
      <div className="flex flex-col gap-4 pb-7">
        <h1 className="sr-only">Questões</h1>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs font-bold">
          <p className="uppercase tracking-[.06em] text-destaque">
            Meta de hoje: {feitasHoje} de {META_DIARIA}
            <span className="text-white/45"> · {faltam ? `faltam ${faltam}` : "meta batida"}</span>
          </p>
          <p className="tabular-nums text-suave">{formatarNumero(contagens[status])} questões neste filtro</p>
        </div>

        <SelecaoAtual
          tipo="questoes"
          disciplinaId={disciplinaId}
          partes={[nomes.disciplina, nomes.assunto]}
        />

        <Filtros contagens={contagens} atual={{ status }} />

        {!situacao.assinante && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-suave">
            <span className="tabular-nums">
              {Math.max(LIMITE_GRATIS_DIA - situacao.respondidasHoje, 0)} de {LIMITE_GRATIS_DIA} questões grátis hoje.
            </span>
            <Link href="/assinatura" className="font-bold text-destaque hover:underline">
              Assinar e estudar sem limite
            </Link>
          </p>
        )}
      </div>

      {/* Separação por padding e borda (não por margem): mesmo espaço em qualquer navegador. */}
      <div className="border-t border-borda pt-7">
        {questoes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-borda p-10 text-center text-sm text-suave">
            Nenhuma questão encontrada com esses filtros.
          </div>
        ) : (
          <Resolucao
            key={`${disciplinaId}-${assuntoIds.join(".")}-${status}-${inicio}-${texto("cursor") ?? ""}`}
            questoes={questoes}
            inicio={(pagina - 1) * TAMANHO_PAGINA + 1}
            proximaUrl={proximaUrl}
          />
        )}
      </div>
    </div>
  );
}
