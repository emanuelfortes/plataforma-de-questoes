"use client";

import { Check, PencilLine, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Selo } from "@/components/admin/kit";
import { classeCampo } from "@/components/campo-senha";
import { Button } from "@/components/ui/button";
import type { Alternativa } from "@/db/schema/conteudo";
import type { AnaliseAlternativa, AuditoriaFlashcard, ResultadoAuditoria } from "@/db/schema/revisao";
import { ROTULO_DIFICULDADE, dificuldadePorNivel } from "@/lib/dificuldade";
import { ROTULO_AUDITORIA, montarComentario } from "@/lib/revisao";
import { cn } from "@/lib/utils";
import { aprovarFlashcardRevisao, aprovarRevisao, aprovarRevisaoEmLote, rejeitarRevisao, resolverReporteAdmin } from "@/server/acoes-admin";

export type DadosRevisao = {
  id: number;
  status: string;
  statusAuditoria: string;
  assunto: string;
  subtopico: string | null;
  banca: string;
  dificuldade: number;
  enunciado: string;
  alternativas: Alternativa[];
  gabarito: string;
  comentario: string;
  analiseAlternativas: AnaliseAlternativa[];
  fundamentoLegal: string | null;
  fundamentoJurisprudencial: string | null;
  observacaoTemporal: string | null;
  pegadinha: string | null;
  destaques: { tipo: string; texto: string }[] | null;
  auditoria: ResultadoAuditoria;
  lote: string;
  motivoRevisao: string | null;
  revisadoPor: string | null;
};

const TOM_AUDITORIA: Record<string, "acerto" | "marca" | "destaque"> = {
  VALIDADA: "acerto",
  VALIDADA_COM_RESSALVA: "marca",
  NECESSITA_DE_CONFERENCIA: "destaque",
};

/** Uma questão da fila de revisão: conteúdo completo, parecer do auditor e as ações do dono. */
export function CartaoRevisao({ q }: { q: DadosRevisao }) {
  const [modo, setModo] = useState<"ver" | "editar" | "rejeitar">("ver");
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const comentarioMontado = montarComentario(q);

  const [enunciado, setEnunciado] = useState(q.enunciado);
  const [alternativas, setAlternativas] = useState(q.alternativas);
  const [gabarito, setGabarito] = useState(q.gabarito);
  const [comentario, setComentario] = useState(comentarioMontado);
  const [motivo, setMotivo] = useState("");

  const pendente = q.status === "pendente_revisao" && !feito;
  const nivel = dificuldadePorNivel(q.dificuldade);

  function executar(acao: () => Promise<{ ok: boolean; erro?: string }>, mensagem: string) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) return setErro(r.erro ?? "Não deu certo.");
      setFeito(mensagem);
      setModo("ver");
    });
  }

  return (
    <article className={cn("space-y-4 rounded-2xl border border-borda bg-superficie p-4 sm:p-5", feito && "opacity-60")}>
      <header className="flex flex-wrap items-center gap-2">
        <Selo tom={TOM_AUDITORIA[q.statusAuditoria] ?? "neutro"}>{ROTULO_AUDITORIA[q.statusAuditoria] ?? q.statusAuditoria}</Selo>
        {q.auditoria.ajuste?.motivos.length ? <Selo tom="neutro">Ajustada</Selo> : null}
        {q.auditoria.regenerada && <Selo tom="neutro">Regenerada</Selo>}
        <span className="text-xs text-suave">
          {q.assunto}
          {q.subtopico ? ` · ${q.subtopico}` : ""} · {q.banca} · {nivel ? ROTULO_DIFICULDADE[nivel] : "sem nível"} · {q.lote}
        </span>
      </header>

      {modo === "editar" ? (
        <div className="space-y-3">
          <label className="block space-y-1 text-xs font-bold text-suave">
            Enunciado
            <textarea value={enunciado} onChange={(e) => setEnunciado(e.target.value)} rows={5} className={cn(classeCampo, "h-auto py-2 font-normal text-texto")} />
          </label>
          {alternativas.map((a, i) => (
            <label key={a.letra} className="flex items-start gap-2 text-sm">
              <input type="radio" name={`gabarito-${q.id}`} checked={gabarito === a.letra} onChange={() => setGabarito(a.letra)} className="mt-3" aria-label={`Gabarito ${a.letra}`} />
              <span className="mt-2.5 w-5 font-extrabold">{a.letra})</span>
              <textarea
                value={a.texto}
                onChange={(e) => setAlternativas(alternativas.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
                rows={2}
                className={cn(classeCampo, "h-auto flex-1 py-2")}
              />
            </label>
          ))}
          <label className="block space-y-1 text-xs font-bold text-suave">
            Comentário que o aluno verá (já com análise, fundamentos e destaques)
            <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={12} className={cn(classeCampo, "h-auto py-2 font-normal text-texto")} />
          </label>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-line text-[15px] leading-relaxed">{q.enunciado}</p>
          <ol className="space-y-1.5">
            {q.alternativas.map((a) => {
              const analise = q.analiseAlternativas.find((x) => x.letra === a.letra);
              return (
                <li key={a.letra} className={cn("rounded-lg border px-3 py-2 text-sm", a.letra === q.gabarito ? "border-acerto bg-acerto-suave" : "border-borda")}>
                  <span className="font-extrabold">{a.letra})</span> {a.texto}
                  {analise && <p className="mt-1 text-xs text-suave">{analise.justificativa}</p>}
                </li>
              );
            })}
          </ol>
          <details className="rounded-lg bg-camada px-3 py-2 text-sm">
            <summary className="cursor-pointer text-xs font-bold text-suave">Comentário que o aluno verá</summary>
            <p className="mt-2 whitespace-pre-line text-texto/85">{comentarioMontado}</p>
          </details>
        </>
      )}

      <div className="space-y-1.5 rounded-lg border border-dashed border-borda px-3 py-2 text-sm">
        <p>
          <span className="font-bold">Auditor:</span> {q.auditoria.justificativa}
        </p>
        {q.auditoria.problemas.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-suave">
            {q.auditoria.problemas.map((p, i) => (
              <li key={i}>
                <b>{p.tipo}</b> ({p.gravidade}): {p.descricao}
              </li>
            ))}
          </ul>
        )}
        {q.auditoria.correcao_sugerida && (
          <p className="text-xs">
            <span className="font-bold text-destaque">Correção sugerida:</span> {q.auditoria.correcao_sugerida}
          </p>
        )}
        {q.auditoria.citacoes_jurisprudencia.length > 0 && (
          <p className="text-xs text-erro">Cita julgado fora da lista: {q.auditoria.citacoes_jurisprudencia.join(", ")}</p>
        )}
        {q.auditoria.alertas?.length ? <p className="text-xs font-bold text-destaque">Conferir: {q.auditoria.alertas.join("; ")}</p> : null}
        <SegundoParecer segundo={q.auditoria.segundo} motivos={q.auditoria.motivos_fila} />
        {q.auditoria.ajuste?.motivos.length ? (
          <details className="text-xs text-suave">
            <summary className="cursor-pointer font-bold">Por que foi ajustada</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {q.auditoria.ajuste.motivos.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {!pendente ? (
        <p className="text-sm font-bold text-suave">
          {feito ?? (q.status === "aprovada" ? "Aprovada" : "Rejeitada")}
          {!feito && q.motivoRevisao ? `: ${q.motivoRevisao}` : ""}
          {!feito && q.revisadoPor ? ` (${q.revisadoPor})` : ""}
        </p>
      ) : modo === "rejeitar" ? (
        <div className="space-y-2">
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo da rejeição" className={cn(classeCampo, "h-auto py-2")} />
          <div className="flex flex-wrap gap-2">
            <Button tamanho="pequeno" disabled={ocupado} onClick={() => executar(() => rejeitarRevisao(q.id, motivo), "Rejeitada")}>
              Confirmar rejeição
            </Button>
            <Button tamanho="pequeno" variante="fantasma" onClick={() => setModo("ver")}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {modo === "editar" ? (
            <>
              <Button
                tamanho="pequeno"
                disabled={ocupado}
                onClick={() => executar(() => aprovarRevisao(q.id, { enunciado, alternativas, gabarito, comentario }), "Aprovada com edição")}
              >
                <Check className="size-4" aria-hidden /> Salvar e aprovar
              </Button>
              <Button tamanho="pequeno" variante="fantasma" onClick={() => setModo("ver")}>
                Cancelar edição
              </Button>
            </>
          ) : (
            <>
              <Button tamanho="pequeno" disabled={ocupado} onClick={() => executar(() => aprovarRevisao(q.id), "Aprovada")}>
                <Check className="size-4" aria-hidden /> Aprovar
              </Button>
              <Button tamanho="pequeno" variante="contorno" onClick={() => setModo("editar")}>
                <PencilLine className="size-4" aria-hidden /> Editar e aprovar
              </Button>
              <Button tamanho="pequeno" variante="contorno" onClick={() => setModo("rejeitar")}>
                <X className="size-4" aria-hidden /> Rejeitar
              </Button>
            </>
          )}
        </div>
      )}
      {erro && <p className="text-sm font-bold text-erro">{erro}</p>}
    </article>
  );
}

/** Aprova de uma vez as questões da página que o auditor deixou como "Validada". */
export function AprovarValidadas({ ids, tipo = "questao" }: { ids: number[]; tipo?: "questao" | "flashcard" }) {
  const [ocupado, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  if (!ids.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        tamanho="pequeno"
        disabled={ocupado || mensagem !== null}
        onClick={() =>
          iniciar(async () => {
            const r = await aprovarRevisaoEmLote(ids, tipo);
            setMensagem(r.ok ? `${r.aprovadas} aprovadas.` : r.erro);
          })
        }
      >
        <Check className="size-4" aria-hidden /> Aprovar as {ids.length} validadas desta página
      </Button>
      {mensagem && <span className="text-sm text-suave">{mensagem}</span>}
    </div>
  );
}

/** Parecer do segundo auditor e por que o item não foi aprovado sozinho (produção automática). */
function SegundoParecer({ segundo, motivos }: { segundo?: ResultadoAuditoria["segundo"]; motivos?: string[] }) {
  if (!segundo && !motivos?.length) return null;
  return (
    <>
      {segundo && (
        <p className="text-xs">
          <span className="font-bold">2º auditor ({ROTULO_AUDITORIA[segundo.status] ?? segundo.status}):</span> {segundo.justificativa}
          {segundo.correcao_sugerida ? ` Correção sugerida: ${segundo.correcao_sugerida}` : ""}
        </p>
      )}
      {motivos?.length ? <p className="text-xs text-suave">Ficou para revisão manual: {motivos.join("; ")}</p> : null}
    </>
  );
}

export type DadosFlashcardRevisao = {
  id: number;
  status: string;
  statusAuditoria: string;
  assunto: string;
  subtopico: string | null;
  frente: string;
  verso: string;
  leiReferencia: string | null;
  lote: string;
  auditoria: AuditoriaFlashcard;
  motivoRevisao: string | null;
  revisadoPor: string | null;
};

/** Um flashcard da fila: frente, verso, parecer e ações. */
export function CartaoFlashcardRevisao({ f }: { f: DadosFlashcardRevisao }) {
  const [modo, setModo] = useState<"ver" | "editar" | "rejeitar">("ver");
  const [frente, setFrente] = useState(f.frente);
  const [verso, setVerso] = useState(f.verso);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const pendente = f.status === "pendente_revisao" && !feito;

  function executar(acao: () => Promise<{ ok: boolean; erro?: string }>, mensagem: string) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) return setErro(r.erro ?? "Não deu certo.");
      setFeito(mensagem);
      setModo("ver");
    });
  }

  return (
    <article className={cn("space-y-3 rounded-2xl border border-borda bg-superficie p-4 sm:p-5", feito && "opacity-60")}>
      <header className="flex flex-wrap items-center gap-2">
        <Selo tom={TOM_AUDITORIA[f.statusAuditoria] ?? "neutro"}>{ROTULO_AUDITORIA[f.statusAuditoria] ?? f.statusAuditoria}</Selo>
        <span className="text-xs text-suave">
          {f.assunto}
          {f.subtopico ? ` · ${f.subtopico}` : ""} · {f.lote}
        </span>
      </header>
      {modo === "editar" ? (
        <div className="space-y-2">
          <textarea value={frente} onChange={(e) => setFrente(e.target.value)} rows={2} className={cn(classeCampo, "h-auto py-2")} aria-label="Frente" />
          <textarea value={verso} onChange={(e) => setVerso(e.target.value)} rows={5} className={cn(classeCampo, "h-auto py-2")} aria-label="Verso" />
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <p className="rounded-lg border border-borda bg-camada px-3 py-2 text-sm font-bold">{f.frente}</p>
          <p className="whitespace-pre-line rounded-lg border border-acerto bg-acerto-suave px-3 py-2 text-sm">{f.verso}</p>
        </div>
      )}
      <div className="space-y-1.5 rounded-lg border border-dashed border-borda px-3 py-2 text-sm">
        <p>
          <span className="font-bold">Auditor:</span> {f.auditoria.justificativa}
        </p>
        {f.auditoria.problemas.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-suave">
            {f.auditoria.problemas.map((p, i) => (
              <li key={i}>
                <b>{p.tipo}</b> ({p.gravidade}): {p.descricao}
              </li>
            ))}
          </ul>
        )}
        {f.auditoria.correcao_sugerida && (
          <p className="text-xs">
            <span className="font-bold text-destaque">Correção sugerida:</span> {f.auditoria.correcao_sugerida}
          </p>
        )}
        {f.auditoria.alertas?.length ? <p className="text-xs font-bold text-destaque">Conferir: {f.auditoria.alertas.join("; ")}</p> : null}
        <SegundoParecer segundo={f.auditoria.segundo} motivos={f.auditoria.motivos_fila} />
      </div>
      {!pendente ? (
        <p className="text-sm font-bold text-suave">
          {feito ?? (f.status === "aprovada" ? "Aprovado" : "Rejeitado")}
          {!feito && f.motivoRevisao ? `: ${f.motivoRevisao}` : ""}
          {!feito && f.revisadoPor ? ` (${f.revisadoPor})` : ""}
        </p>
      ) : modo === "rejeitar" ? (
        <div className="space-y-2">
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo da rejeição" className={cn(classeCampo, "h-auto py-2")} />
          <div className="flex flex-wrap gap-2">
            <Button tamanho="pequeno" disabled={ocupado} onClick={() => executar(() => rejeitarRevisao(f.id, motivo, "flashcard"), "Rejeitado")}>
              Confirmar rejeição
            </Button>
            <Button tamanho="pequeno" variante="fantasma" onClick={() => setModo("ver")}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {modo === "editar" ? (
            <>
              <Button tamanho="pequeno" disabled={ocupado} onClick={() => executar(() => aprovarFlashcardRevisao(f.id, { frente, verso }), "Aprovado com edição")}>
                <Check className="size-4" aria-hidden /> Salvar e aprovar
              </Button>
              <Button tamanho="pequeno" variante="fantasma" onClick={() => setModo("ver")}>
                Cancelar edição
              </Button>
            </>
          ) : (
            <>
              <Button tamanho="pequeno" disabled={ocupado} onClick={() => executar(() => aprovarFlashcardRevisao(f.id), "Aprovado")}>
                <Check className="size-4" aria-hidden /> Aprovar
              </Button>
              <Button tamanho="pequeno" variante="contorno" onClick={() => setModo("editar")}>
                <PencilLine className="size-4" aria-hidden /> Editar e aprovar
              </Button>
              <Button tamanho="pequeno" variante="contorno" onClick={() => setModo("rejeitar")}>
                <X className="size-4" aria-hidden /> Rejeitar
              </Button>
            </>
          )}
        </div>
      )}
      {erro && <p className="text-sm font-bold text-erro">{erro}</p>}
    </article>
  );
}

export type DadosReporte = {
  id: number;
  tipo: string;
  motivo: string;
  criadoEm: Date;
  questao: { origem: string | null; enunciado: string; alternativas: Alternativa[]; gabarito: string; comentario: string | null } | null;
  flashcard: { origem: string | null; frente: string; verso: string } | null;
};

/** Item reportado por aluno (já fora do ar). Os de IA também voltaram para a fila de revisão. */
export function CartaoReporte({ r }: { r: DadosReporte }) {
  const [feito, setFeito] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const origemIa = (r.questao ?? r.flashcard)?.origem === "ia";
  const decidir = (decisao: "restaurado" | "removido") =>
    iniciar(async () => {
      const res = await resolverReporteAdmin(r.id, decisao);
      if (!res.ok) return setErro(res.erro);
      setFeito(decisao === "restaurado" ? "Voltou ao ar" : "Mantido fora do ar");
    });
  return (
    <article className={cn("space-y-3 rounded-2xl border border-borda bg-superficie p-4 sm:p-5", feito && "opacity-60")}>
      <header className="flex flex-wrap items-center gap-2">
        <Selo tom="erro">{r.tipo === "questao" ? "Questão reportada" : "Flashcard reportado"}</Selo>
        <span className="text-xs text-suave">
          {new Date(r.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          {origemIa ? " · gerado por IA (também está na fila de revisão)" : " · importado por arquivo"}
        </span>
      </header>
      <p className="text-sm">
        <span className="font-bold">Motivo do aluno:</span> {r.motivo}
      </p>
      {r.questao && (
        <>
          <p className="whitespace-pre-line text-sm">{r.questao.enunciado}</p>
          <ol className="space-y-1 text-sm">
            {r.questao.alternativas.map((a) => (
              <li key={a.letra} className={cn("rounded-lg border px-3 py-1.5", a.letra === r.questao?.gabarito ? "border-acerto bg-acerto-suave" : "border-borda")}>
                <b>{a.letra})</b> {a.texto}
              </li>
            ))}
          </ol>
        </>
      )}
      {r.flashcard && (
        <div className="grid gap-2 sm:grid-cols-2">
          <p className="rounded-lg border border-borda bg-camada px-3 py-2 text-sm font-bold">{r.flashcard.frente}</p>
          <p className="whitespace-pre-line rounded-lg border border-acerto bg-acerto-suave px-3 py-2 text-sm">{r.flashcard.verso}</p>
        </div>
      )}
      {feito ? (
        <p className="text-sm font-bold text-suave">{feito}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button tamanho="pequeno" disabled={ocupado} onClick={() => decidir("restaurado")}>
            Reporte improcedente: voltar ao ar
          </Button>
          <Button tamanho="pequeno" variante="contorno" disabled={ocupado} onClick={() => decidir("removido")}>
            Manter fora do ar
          </Button>
        </div>
      )}
      {origemIa && !feito && <p className="text-xs text-suave">Para corrigir o texto, edite e aprove na aba de {r.tipo === "questao" ? "questões" : "flashcards"}.</p>}
      {erro && <p className="text-sm font-bold text-erro">{erro}</p>}
    </article>
  );
}
