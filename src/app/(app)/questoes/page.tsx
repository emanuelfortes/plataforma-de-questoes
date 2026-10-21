import { randomInt } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { Filtros } from "@/components/questoes/filtros";
import { Resolucao } from "@/components/questoes/resolucao";
import { FiltrosAplicados, type Etiqueta } from "@/components/questoes/filtros-aplicados";
import {
  lerDificuldades,
  lerFiltroStatus,
  lerId,
  lerIds,
  lerTipoQuestao,
  ROTULO_DIFICULDADE_FILTRO,
  ROTULO_TIPO_QUESTAO,
} from "@/lib/filtros";
import { LIMITE_GRATIS_DIA } from "@/lib/planos";
import { exigirUsuario } from "@/lib/sessao";
import { formatarNumero } from "@/lib/utils";
import { situacaoDoAluno } from "@/server/assinatura";
import { nomesSelecao, temCertoErrado } from "@/server/estudar";
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
  const dificuldades = lerDificuldades(sp.dificuldade);
  // Sem questões de certo ou errado no banco, o tipo é ignorado (o filtro leria a matéria inteira para nada).
  const tipoPedido = lerTipoQuestao(texto("tipoq"));
  const tipoQuestao = tipoPedido && (await temCertoErrado()) ? tipoPedido : undefined;
  // Com dificuldade ou tipo, os totais pré-calculados (por matéria e área) não valem: os números somem.
  const comOpcoes = dificuldades.length > 0 || !!tipoQuestao;
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
    listarQuestoes({ usuarioId: usuario.id, disciplinaId, assuntoIds, status, inicio, cursor, voltou, dificuldades, tipo: tipoQuestao }),
  ]);

  // Filtros na URL (sem a posição na sequência). Tirar um filtro recomeça a sequência, com o mesmo ponto sorteado.
  type Filtro = { disciplina?: number; assuntos: number[]; dificuldades: string[]; tipo?: string; status: string };
  const atual: Filtro = { disciplina: disciplinaId, assuntos: assuntoIds, dificuldades, tipo: tipoQuestao, status };
  const parametros = (x: Filtro) => {
    const p = new URLSearchParams();
    if (x.disciplina) p.set("disciplina", String(x.disciplina));
    if (x.disciplina) for (const id of x.assuntos) p.append("assunto", String(id));
    for (const d of x.dificuldades) p.append("dificuldade", d);
    if (x.tipo) p.set("tipoq", x.tipo);
    if (x.status !== "todas") p.set("status", x.status);
    return p;
  };
  const lista = (x: Filtro) => {
    const p = parametros(x);
    p.set("inicio", String(inicio));
    return `/questoes?${p}`;
  };
  const etiquetas: Etiqueta[] = [
    // Sem áreas, a matéria inteira é o filtro; com áreas, cada área é uma etiqueta (a última volta à matéria inteira).
    ...(disciplinaId && nomes.areas.length === 0 && nomes.disciplina
      ? [{ chave: "materia", grupo: "Matéria inteira", rotulo: nomes.disciplina, sem: lista({ ...atual, disciplina: undefined, assuntos: [] }) }]
      : []),
    ...nomes.areas.map((a) => ({
      chave: `area-${a.id}`,
      grupo: nomes.disciplina ?? "Área",
      rotulo: a.nome,
      sem: lista({ ...atual, assuntos: assuntoIds.filter((id) => id !== a.id) }),
    })),
    ...dificuldades.map((d) => ({
      chave: `dif-${d}`,
      grupo: "Dificuldade",
      rotulo: ROTULO_DIFICULDADE_FILTRO[d],
      sem: lista({ ...atual, dificuldades: dificuldades.filter((x) => x !== d) }),
    })),
    ...(tipoQuestao ? [{ chave: "tipo", grupo: "Tipo de questão", rotulo: ROTULO_TIPO_QUESTAO[tipoQuestao], sem: lista({ ...atual, tipo: undefined }) }] : []),
  ];
  const editarFiltros = `/estudar?tipo=questoes&${parametros(atual)}`;
  const semFiltros = etiquetas.length || status !== "todas" ? lista({ assuntos: [], dificuldades: [], status: "todas" }) : null;

  const proximaUrl = (() => {
    if (!proximo) return null;
    const p = new URLSearchParams();
    if (disciplinaId) p.set("disciplina", String(disciplinaId));
    for (const id of assuntoIds) p.append("assunto", String(id));
    if (status !== "todas") p.set("status", status);
    for (const d of dificuldades) p.append("dificuldade", d);
    if (tipoQuestao) p.set("tipoq", tipoQuestao);
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
            <span className="text-suave"> · {faltam ? `faltam ${faltam}` : "meta batida"}</span>
          </p>
          {!comOpcoes && (
            <p className="tabular-nums text-suave">{formatarNumero(contagens[status])} questões neste filtro</p>
          )}
        </div>

        <FiltrosAplicados etiquetas={etiquetas} editar={editarFiltros} limpar={semFiltros} />

        <Filtros contagens={contagens} atual={{ status }} semNumeros={comOpcoes} />

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
            key={`${disciplinaId}-${assuntoIds.join(".")}-${status}-${dificuldades.join(".")}-${tipoQuestao ?? ""}-${inicio}-${texto("cursor") ?? ""}`}
            questoes={questoes}
            inicio={(pagina - 1) * TAMANHO_PAGINA + 1}
            proximaUrl={proximaUrl}
          />
        )}
      </div>
    </div>
  );
}
