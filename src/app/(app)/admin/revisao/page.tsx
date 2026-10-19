import type { Metadata } from "next";
import Link from "next/link";
import { AprovarValidadas, CartaoFlashcardRevisao, CartaoReporte, CartaoRevisao } from "@/components/admin/cartao-revisao";
import { CabecalhoPagina, CardMetrica, LinkBotao, Secao } from "@/components/admin/kit";
import { ROTULO_AUDITORIA, ROTULO_STATUS_REVISAO, STATUS_REVISAO, type StatusRevisao } from "@/lib/revisao";
import { cn, formatarNumero } from "@/lib/utils";
import {
  contarReportesAbertos,
  listarReportesAbertos,
  listarRevisao,
  listarRevisaoFlashcards,
  resumoRevisao,
  resumoRevisaoFlashcards,
} from "@/server/revisao";

export const metadata: Metadata = { title: "Revisão de questões" };

type Aba = "questoes" | "flashcards" | "reportados";
type Params = Promise<{ aba?: string; status?: string; topico?: string; auditoria?: string; depois?: string }>;

const classeChip = (ativo: boolean) =>
  cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
    ativo ? "border-marca bg-marca text-sobre-marca" : "border-borda text-texto/75 hover:bg-camada-forte",
  );

// exigirAdmin() já roda no layout de /admin; as ações de aprovar e rejeitar também o chamam.
export default async function PaginaRevisao({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const aba: Aba = sp.aba === "flashcards" || sp.aba === "reportados" ? sp.aba : "questoes";
  const status: StatusRevisao = STATUS_REVISAO.includes(sp.status as StatusRevisao) ? (sp.status as StatusRevisao) : "pendente_revisao";
  const auditoria = sp.auditoria && sp.auditoria in ROTULO_AUDITORIA ? sp.auditoria : undefined;
  const topico = sp.topico?.slice(0, 200) || undefined;
  const depoisDe = Number.parseInt(sp.depois ?? "", 10) || undefined;
  const filtro = { status, topico, auditoria, depoisDe };

  const [resumoQ, resumoF, reportados] = await Promise.all([resumoRevisao(), resumoRevisaoFlashcards(), contarReportesAbertos()]);
  const resumo = aba === "flashcards" ? resumoF : resumoQ;

  const link = (mudancas: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const atual = { aba: aba === "questoes" ? undefined : aba, status: status === "pendente_revisao" ? undefined : status, topico, auditoria, ...mudancas };
    for (const [k, v] of Object.entries(atual)) if (v !== undefined && v !== "") p.set(k, String(v));
    return `/admin/revisao${p.size ? `?${p}` : ""}`;
  };

  const ABAS: { aba: Aba; rotulo: string; n: number }[] = [
    { aba: "questoes", rotulo: "Questões", n: resumoQ.porStatus.pendente_revisao ?? 0 },
    { aba: "flashcards", rotulo: "Flashcards", n: resumoF.porStatus.pendente_revisao ?? 0 },
    { aba: "reportados", rotulo: "Reportados por alunos", n: reportados },
  ];

  let conteudo: React.ReactNode;
  let proximo: number | null = null;
  let validadas: number[] = [];
  if (aba === "reportados") {
    const pagina = await listarReportesAbertos(depoisDe);
    proximo = pagina.proximo;
    conteudo = pagina.itens.length ? pagina.itens.map((r) => <CartaoReporte key={r.id} r={r} />) : null;
  } else if (aba === "flashcards") {
    const pagina = await listarRevisaoFlashcards(filtro);
    proximo = pagina.proximo;
    validadas = status === "pendente_revisao" ? pagina.itens.filter((f) => f.statusAuditoria === "VALIDADA").map((f) => f.id) : [];
    conteudo = pagina.itens.length ? pagina.itens.map((f) => <CartaoFlashcardRevisao key={f.id} f={f} />) : null;
  } else {
    const pagina = await listarRevisao(filtro);
    proximo = pagina.proximo;
    validadas = status === "pendente_revisao" ? pagina.itens.filter((q) => q.statusAuditoria === "VALIDADA").map((q) => q.id) : [];
    conteudo = pagina.itens.length ? pagina.itens.map((q) => <CartaoRevisao key={q.id} q={q} />) : null;
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Revisão de questões"
        subtitulo="Questões e flashcards gerados por IA e auditados, e itens reportados por alunos. Só entram na plataforma depois de aprovados."
      />

      <nav aria-label="Tipo" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {ABAS.map((a) => (
          <Link key={a.aba} href={`/admin/revisao${a.aba === "questoes" ? "" : `?aba=${a.aba}`}`} aria-current={aba === a.aba ? "page" : undefined} className={classeChip(aba === a.aba)}>
            {a.rotulo}
            <span className="tabular-nums opacity-70">{formatarNumero(a.n)}</span>
          </Link>
        ))}
      </nav>

      {aba !== "reportados" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <CardMetrica rotulo="Pendentes" valor={formatarNumero(resumo.porStatus.pendente_revisao ?? 0)} destaque />
            <CardMetrica rotulo="Aprovadas" valor={formatarNumero(resumo.porStatus.aprovada ?? 0)} tom="acerto" />
            <CardMetrica rotulo="Rejeitadas" valor={formatarNumero(resumo.porStatus.rejeitada ?? 0)} />
          </div>

          <Secao>
            <div className="space-y-3 p-4 sm:p-5">
              <nav aria-label="Situação" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
                {STATUS_REVISAO.map((s) => (
                  <Link key={s} href={link({ status: s === "pendente_revisao" ? undefined : s, depois: undefined })} aria-current={status === s ? "page" : undefined} className={classeChip(status === s)}>
                    {ROTULO_STATUS_REVISAO[s]}
                    <span className="tabular-nums opacity-70">{formatarNumero(resumo.porStatus[s] ?? 0)}</span>
                  </Link>
                ))}
              </nav>
              <form action="/admin/revisao" className="flex flex-wrap gap-2">
                {aba !== "questoes" && <input type="hidden" name="aba" value={aba} />}
                {status !== "pendente_revisao" && <input type="hidden" name="status" value={status} />}
                <select name="topico" defaultValue={topico ?? ""} className="h-10 min-w-0 flex-1 rounded-lg border border-borda bg-camada px-3 text-sm" aria-label="Tópico">
                  <option value="">Todos os tópicos</option>
                  {resumo.topicos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({formatarNumero(t.pendentes)} pendentes)
                    </option>
                  ))}
                </select>
                <select name="auditoria" defaultValue={auditoria ?? ""} className="h-10 rounded-lg border border-borda bg-camada px-3 text-sm" aria-label="Parecer do auditor">
                  <option value="">Qualquer parecer</option>
                  {Object.entries(ROTULO_AUDITORIA).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
                <button type="submit" className="h-10 rounded-lg bg-marca px-4 text-sm font-bold text-sobre-marca hover:bg-marca-forte">
                  Filtrar
                </button>
              </form>
              <AprovarValidadas key={`${aba}-${validadas.join(",")}`} ids={validadas} tipo={aba === "flashcards" ? "flashcard" : "questao"} />
            </div>
          </Secao>
        </>
      )}

      {conteudo ? (
        <div className="space-y-4">{conteudo}</div>
      ) : (
        <p className="rounded-2xl border border-borda bg-superficie px-5 py-10 text-center text-sm text-suave">
          {aba === "reportados" ? "Nenhum reporte aberto." : "Nada neste filtro."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {depoisDe && <LinkBotao href={link({ depois: undefined })}>Voltar ao início</LinkBotao>}
        {proximo && <LinkBotao href={link({ depois: proximo })}>Próximas</LinkBotao>}
      </div>
    </>
  );
}
