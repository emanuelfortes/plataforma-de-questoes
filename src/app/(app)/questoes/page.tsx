import type { Metadata } from "next";
import Link from "next/link";
import { Filtros } from "@/components/questoes/filtros";
import { QuestaoCard } from "@/components/questoes/questao-card";
import { variantesBotao } from "@/components/ui/button";
import { lerFiltroStatus, lerId } from "@/lib/filtros";
import { exigirUsuario } from "@/lib/sessao";
import { formatarNumero } from "@/lib/utils";
import {
  contarPorStatus,
  listarAssuntos,
  listarDisciplinas,
  listarQuestoes,
  TAMANHO_PAGINA,
} from "@/server/questoes";

export const metadata: Metadata = { title: "Questões" };

type Params = Promise<{ [chave: string]: string | string[] | undefined }>;

export default async function PaginaQuestoes({ searchParams }: { searchParams: Params }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const texto = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const disciplinaId = lerId(texto("disciplina"));
  const assuntoId = disciplinaId ? lerId(texto("assunto")) : undefined;
  const status = lerFiltroStatus(texto("status"));
  const cursor = lerId(texto("cursor"));
  const pagina = Math.max(1, lerId(texto("pagina")) ?? 1);

  const [disciplinas, assuntos, contagens, { questoes, proximoCursor }] = await Promise.all([
    listarDisciplinas(),
    disciplinaId ? listarAssuntos(disciplinaId) : Promise.resolve([]),
    contarPorStatus({ usuarioId: usuario.id, disciplinaId, assuntoId }),
    listarQuestoes({ usuarioId: usuario.id, disciplinaId, assuntoId, status, cursor }),
  ]);

  const proximaUrl = (() => {
    if (!proximoCursor) return null;
    const p = new URLSearchParams();
    if (disciplinaId) p.set("disciplina", String(disciplinaId));
    if (assuntoId) p.set("assunto", String(assuntoId));
    if (status !== "todas") p.set("status", status);
    p.set("cursor", String(proximoCursor));
    p.set("pagina", String(pagina + 1));
    return `/questoes?${p.toString()}`;
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Questões</h1>
        <p className="mt-1 text-sm text-suave">
          {formatarNumero(contagens[status])} questões neste filtro
        </p>
      </div>

      <Filtros
        disciplinas={disciplinas}
        assuntos={assuntos}
        contagens={contagens}
        atual={{ disciplina: disciplinaId, assunto: assuntoId, status }}
      />

      {questoes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-borda p-10 text-center text-sm text-suave">
          Nenhuma questão encontrada com esses filtros.
        </div>
      ) : (
        <div className="space-y-4">
          {questoes.map((q, i) => (
            <QuestaoCard
              key={q.id}
              questao={q}
              numero={(pagina - 1) * TAMANHO_PAGINA + i + 1}
            />
          ))}
        </div>
      )}

      <nav className="flex items-center justify-between pt-2" aria-label="Paginação">
        {cursor ? (
          <Link href="/questoes" className={variantesBotao({ variante: "fantasma" })}>
            Voltar ao início
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm text-suave">Página {pagina}</span>
        {proximaUrl ? (
          <Link href={proximaUrl} className={variantesBotao({ variante: "contorno" })}>
            Próxima página
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
