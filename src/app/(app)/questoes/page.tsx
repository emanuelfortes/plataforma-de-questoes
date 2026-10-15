import { randomInt } from "node:crypto";
import type { Metadata } from "next";
import { Filtros } from "@/components/questoes/filtros";
import { Resolucao } from "@/components/questoes/resolucao";
import { SelecaoAtual } from "@/components/selecao-atual";
import { lerFiltroStatus, lerId } from "@/lib/filtros";
import { exigirUsuario } from "@/lib/sessao";
import { formatarNumero } from "@/lib/utils";
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
  const assuntoId = disciplinaId ? lerId(texto("assunto")) : undefined;
  const status = lerFiltroStatus(texto("status"));
  // Ponto de partida sorteado a cada sessão nova; as páginas seguintes levam o mesmo na URL.
  const inicioUrl = Number(texto("inicio"));
  const inicio = Number.isInteger(inicioUrl) && inicioUrl >= 0 ? inicioUrl : randomInt(2 ** 31);
  const cursor = lerCursor(texto("cursor"));
  const voltou = texto("volta") === "1";
  const pagina = Math.max(1, lerId(texto("pagina")) ?? 1);

  const [nomes, contagens, { questoes, proximo }] = await Promise.all([
    nomesSelecao(disciplinaId, assuntoId),
    contarPorStatus({ usuarioId: usuario.id, disciplinaId, assuntoId }),
    listarQuestoes({ usuarioId: usuario.id, disciplinaId, assuntoId, status, inicio, cursor, voltou }),
  ]);

  const proximaUrl = (() => {
    if (!proximo) return null;
    const p = new URLSearchParams();
    if (disciplinaId) p.set("disciplina", String(disciplinaId));
    if (assuntoId) p.set("assunto", String(assuntoId));
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">Meta de hoje</p>
          <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-[-.03em]">
            {feitasHoje} de {META_DIARIA}. {faltam ? `Faltam ${faltam}.` : "Meta batida."}
          </h1>
          <p className="mt-2 text-sm text-suave">{formatarNumero(contagens[status])} questões neste filtro</p>
        </div>
      </div>

      <SelecaoAtual
        tipo="questoes"
        disciplinaId={disciplinaId}
        partes={[nomes.disciplina, nomes.assunto]}
      />

      <Filtros contagens={contagens} atual={{ status }} />

      {questoes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-borda p-10 text-center text-sm text-suave">
          Nenhuma questão encontrada com esses filtros.
        </div>
      ) : (
        <Resolucao
          key={`${disciplinaId}-${assuntoId}-${status}-${inicio}-${texto("cursor") ?? ""}`}
          questoes={questoes}
          inicio={(pagina - 1) * TAMANHO_PAGINA + 1}
          proximaUrl={proximaUrl}
        />
      )}
    </div>
  );
}
