import { ArrowLeft, BookOpenCheck, Download, Lock, Printer, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BotaoComecar, FolhaRespostas } from "@/components/simulados/folha-respostas";
import { Card } from "@/components/ui/card";
import { variantesBotao } from "@/components/ui/button";
import { ehAdmin, exigirUsuario } from "@/lib/sessao";
import { ANULADA, formatarTempo, segundosRestantes } from "@/lib/simulados";
import { cn } from "@/lib/utils";
import { temElite } from "@/server/assinatura";
import { encerrado, infoComentado, obterSimuladoAluno, rankingSimulado } from "@/server/simulados";

export const metadata: Metadata = { title: "Simulado" };

export default async function PaginaSimulado({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  if (!(await temElite(usuario))) redirect("/simulados");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const dados = await obterSimuladoAluno(id, usuario.id);
  if (!dados) notFound();
  const { simulado: s, tentativa: t, gabarito } = dados;
  // Lê só a contagem das partes do gabarito comentado (o arquivo em si sai pela rota do PDF, depois da entrega).
  const comentado = await infoComentado(s.id);
  const entregue = !!t?.entregueEm;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/simulados" className="inline-flex items-center gap-1.5 text-sm font-bold text-suave hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden /> Simulados
      </Link>
      <div>
        <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">{s.concurso}</p>
        <h1 className="mt-1 text-[30px] font-extrabold leading-[1.1] tracking-[-.03em]">{s.titulo}</h1>
        <p className="mt-2 text-sm text-suave">
          {s.questoes} questões, tempo de prova {formatarTempo(s.duracaoMin * 60)}.
        </p>
      </div>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <Printer className="hidden size-8 shrink-0 text-marca-clara sm:block" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-texto/85">
          Baixe e <strong>imprima a prova</strong>: resolva no papel, como no dia do concurso, e marque o gabarito aqui com o
          cronômetro correndo.
        </p>
        <a href={`/api/simulados/${s.id}/pdf`} className={variantesBotao({ variante: "contorno", className: "shrink-0" })}>
          <Download className="size-4" aria-hidden /> Baixar a prova
        </a>
      </Card>

      {comentado && (
        <Card className={cn("flex flex-col gap-4 p-5 sm:flex-row sm:items-center", entregue && "border-acerto/40 bg-acerto-suave")}>
          {entregue ? (
            <BookOpenCheck className="hidden size-8 shrink-0 text-acerto sm:block" aria-hidden />
          ) : (
            <Lock className="hidden size-8 shrink-0 text-suave sm:block" aria-hidden />
          )}
          <p className="min-w-0 flex-1 text-sm text-texto/85">
            {entregue ? (
              <>
                <strong>Gabarito comentado liberado.</strong> Cada questão com a explicação de todas as alternativas.
              </>
            ) : (
              <>
                <strong>Gabarito comentado:</strong> libera aqui assim que você entregar a prova.
              </>
            )}
          </p>
          {entregue && (
            <a href={`/api/simulados/${s.id}/pdf?tipo=comentado`} className={variantesBotao({ className: "shrink-0" })}>
              <Download className="size-4" aria-hidden /> Baixar o comentado
            </a>
          )}
        </Card>
      )}

      {!t &&
        (encerrado(s) ? (
          <Card className="p-6 text-sm text-suave">Este simulado já foi encerrado.</Card>
        ) : (
          <BotaoComecar id={s.id} duracaoMin={s.duracaoMin} />
        ))}

      {t && !t.entregueEm && (
        <FolhaRespostas
          id={s.id}
          opcoes={s.opcoes}
          restante={segundosRestantes(t.iniciadoEm, s.duracaoMin)}
          respostasIniciais={t.respostas}
        />
      )}

      {t?.entregueEm && gabarito && (
        <Resultado id={s.id} usuarioId={usuario.id} respostas={t.respostas} gabarito={gabarito} acertos={t.acertos ?? 0} tempoSeg={t.tempoSeg ?? 0} dono={ehAdmin(usuario.email)} />
      )}
    </div>
  );
}

async function Resultado({
  id,
  usuarioId,
  respostas,
  gabarito,
  acertos,
  tempoSeg,
  dono,
}: {
  id: number;
  usuarioId: string;
  respostas: string[];
  gabarito: string[];
  acertos: number;
  tempoSeg: number;
  dono: boolean;
}) {
  const ranking = await rankingSimulado(id, usuarioId, dono);
  const nota = Math.round((acertos / gabarito.length) * 1000) / 10;
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Numero rotulo="Acertos" valor={`${acertos}/${gabarito.length}`} />
        <Numero rotulo="Nota" valor={`${nota.toLocaleString("pt-BR")}%`} />
        <Numero rotulo="Posição" valor={ranking.posicao ? `${ranking.posicao}º` : "-"} dica={`de ${ranking.participantes}`} />
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-extrabold uppercase tracking-[.06em] text-marca-clara">Seu gabarito x gabarito oficial</h2>
        <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {gabarito.map((certa, i) => {
            const sua = respostas[i] ?? "";
            const ok = certa === ANULADA || sua === certa;
            return (
              <li key={i} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm", ok ? "bg-acerto-suave" : "bg-erro-suave")}>
                <span className="w-7 font-extrabold tabular-nums text-suave">{String(i + 1).padStart(2, "0")}</span>
                <span className={cn("font-extrabold", ok ? "text-acerto" : "text-erro")}>{sua || "-"}</span>
                <span className="ml-auto text-xs text-suave">{certa === ANULADA ? "anulada" : ok ? "" : `certa: ${certa}`}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.06em] text-marca-clara">
          <Trophy className="size-4" aria-hidden /> Ranking do simulado
        </h2>
        <p className="text-xs text-suave">
          {dono ? "Mais acertos na frente; no empate, quem entregou em menos tempo." : "Os 3 primeiros: mais acertos na frente; no empate, quem entregou em menos tempo."}
        </p>
        <ol className="overflow-hidden rounded-2xl border border-borda">
          {ranking.lista.map((l, i) => (
            <li key={l.usuarioId} className={cn("flex items-center gap-3 border-t border-borda px-4 py-2.5 first:border-t-0", l.eu && "bg-marca-suave")}>
              <span className="w-8 text-right font-extrabold tabular-nums text-suave">{i + 1}º</span>
              <span className="min-w-0 flex-1 truncate font-bold">
                {l.nome}
                {l.eu && " (você)"}
              </span>
              {l.tempoSeg !== null && <span className="text-xs tabular-nums text-suave">{formatarTempo(l.tempoSeg)}</span>}
              {l.acertos !== null && <span className="w-14 text-right font-extrabold tabular-nums">{l.acertos}</span>}
            </li>
          ))}
        </ol>
      </section>
      <p className="text-center text-xs text-suave">Seu tempo: {formatarTempo(tempoSeg)}</p>
    </>
  );
}

function Numero({ rotulo, valor, dica }: { rotulo: string; valor: string; dica?: string }) {
  return (
    <div className="rounded-2xl border border-borda bg-superficie p-4 text-center">
      <p className="text-xs text-suave">{rotulo}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{valor}</p>
      {dica && <p className="text-xs text-suave">{dica}</p>}
    </div>
  );
}
