"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { classeCampo } from "@/components/campo-senha";
import { Button } from "@/components/ui/button";
import { CONCURSOS_SIMULADO } from "@/lib/planos";
import { MAXIMO_PDF, OPCOES_SIMULADO, TAMANHO_PARTE } from "@/lib/simulados";
import { cn } from "@/lib/utils";
import { apagarSimulado, concluirPdf, editarSimulado, enviarParteDoPdf, novoSimulado } from "@/server/acoes-simulados";

// Simulados do Elite na área do dono: cadastro (dados, gabarito e PDF), edição e exclusão.

const rotulo = "mb-1 block text-xs font-bold text-suave";

/** Envia o PDF em partes (cada uma abaixo do limite da Vercel) e fecha o envio. */
async function enviarPdf(id: number, arquivo: File, progresso: (p: number) => void) {
  if (arquivo.size > MAXIMO_PDF) return `O PDF passa de ${MAXIMO_PDF / 1024 / 1024} MB.`;
  const partes = Math.ceil(arquivo.size / TAMANHO_PARTE);
  for (let i = 0; i < partes; i++) {
    const form = new FormData();
    form.set("id", String(id));
    form.set("parte", String(i));
    form.set("dados", arquivo.slice(i * TAMANHO_PARTE, (i + 1) * TAMANHO_PARTE));
    const r = await enviarParteDoPdf(form);
    if (!r.ok) return r.erro;
    progresso((i + 1) / partes);
  }
  const r = await concluirPdf(id, arquivo.name, arquivo.size, partes);
  return r.ok ? null : r.erro;
}

/** "2026-11-20T08:00" no fuso de Brasília, para o campo datetime-local. */
export function paraCampoData(d: Date | null) {
  if (!d) return "";
  return new Date(d.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function CamposDatas({ inicial }: { inicial?: { titulo: string; duracaoMin: number; liberadoEm: string; encerraEm: string } }) {
  return (
    <>
      <label className="sm:col-span-2">
        <span className={rotulo}>Título</span>
        <input name="titulo" required defaultValue={inicial?.titulo} placeholder="Simulado 01: GM Fortaleza" className={classeCampo} />
      </label>
      <label>
        <span className={rotulo}>Tempo de prova (minutos)</span>
        <input name="duracaoMin" type="number" min={5} max={600} required defaultValue={inicial?.duracaoMin ?? 240} className={classeCampo} />
      </label>
      <label>
        <span className={rotulo}>Libera para os alunos em</span>
        <input name="liberadoEm" type="datetime-local" required defaultValue={inicial?.liberadoEm} className={classeCampo} />
      </label>
      <label>
        <span className={rotulo}>Encerra em (opcional: depois disso ninguém começa)</span>
        <input name="encerraEm" type="datetime-local" defaultValue={inicial?.encerraEm} className={classeCampo} />
      </label>
    </>
  );
}

function CampoGabarito({ inicial, questoes }: { inicial?: string; questoes?: number }) {
  return (
    <label className="sm:col-span-2">
      <span className={rotulo}>
        Gabarito oficial{questoes ? ` (${questoes} questões)` : ""}: as letras em ordem (ex.: ABDCE...), pode separar por espaço,
        vírgula ou linha. Use X para questão anulada (conta ponto para todos).
      </span>
      <textarea name="gabarito" required rows={3} defaultValue={inicial} className={cn(classeCampo, "h-auto py-2 font-mono uppercase tracking-widest")} />
    </label>
  );
}

function CampoPdf({ obrigatorio }: { obrigatorio?: boolean }) {
  return (
    <label className="sm:col-span-2">
      <span className={rotulo}>PDF da prova (o aluno baixa e imprime)</span>
      <input name="pdf" type="file" accept="application/pdf" required={obrigatorio} className="block w-full text-sm" />
    </label>
  );
}

export function NovoSimulado() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  return (
    <form
      className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const pdf = f.get("pdf");
        iniciar(async () => {
          setErro(null);
          setAviso(null);
          if (!(pdf instanceof File) || !pdf.size) return setErro("Escolha o PDF da prova.");
          const r = await novoSimulado(Object.fromEntries([...f.entries()].filter(([k]) => k !== "pdf")));
          if (!r.ok) return setErro(r.erro);
          const falha = await enviarPdf(r.id, pdf, (p) => setAviso(`Enviando o PDF: ${Math.round(p * 100)}%`));
          if (falha) return setErro(`O simulado foi criado, mas o PDF não subiu: ${falha} Envie de novo na lista abaixo.`);
          form.reset();
          setAviso("Simulado criado. Ele aparece para a Tropa de Elite na data de liberação.");
          router.refresh();
        });
      }}
    >
      <CamposDatas />
      <label>
        <span className={rotulo}>Concurso</span>
        <select name="concurso" required className={classeCampo}>
          {CONCURSOS_SIMULADO.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        <span className={rotulo}>Número de questões</span>
        <input name="questoes" type="number" min={1} max={300} required defaultValue={60} className={classeCampo} />
      </label>
      <label>
        <span className={rotulo}>Opções de resposta</span>
        <select name="opcoes" required defaultValue="ABCDE" className={classeCampo}>
          {Object.entries(OPCOES_SIMULADO).map(([valor, nome]) => (
            <option key={valor} value={valor}>
              {nome}
            </option>
          ))}
        </select>
      </label>
      <CampoGabarito />
      <CampoPdf obrigatorio />
      <div className="space-y-2 sm:col-span-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Criar simulado"}
        </Button>
        {aviso && <p className="text-sm font-bold text-acerto">{aviso}</p>}
        {erro && <p className="text-sm font-bold text-erro">{erro}</p>}
      </div>
    </form>
  );
}

type Simulado = {
  id: number;
  titulo: string;
  duracaoMin: number;
  liberadoEm: Date;
  encerraEm: Date | null;
  gabarito: string[];
  temPdf: boolean;
  entregas: number;
};

export function EditarSimulado({ simulado }: { simulado: Simulado }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [apagar, setApagar] = useState(false);
  const [enviando, iniciar] = useTransition();
  return (
    <form
      className="grid gap-4 border-t border-borda p-4 sm:grid-cols-2 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const pdf = f.get("pdf");
        iniciar(async () => {
          setErro(null);
          setAviso(null);
          const r = await editarSimulado(simulado.id, Object.fromEntries([...f.entries()].filter(([k]) => k !== "pdf")));
          if (!r.ok) return setErro(r.erro);
          if (pdf instanceof File && pdf.size) {
            const falha = await enviarPdf(simulado.id, pdf, (p) => setAviso(`Enviando o PDF: ${Math.round(p * 100)}%`));
            if (falha) return setErro(`Dados salvos, mas o PDF não subiu: ${falha}`);
          }
          setAviso(r.recorrigidas ? `Salvo. ${r.recorrigidas} entregas foram recorrigidas com o novo gabarito.` : "Salvo.");
          router.refresh();
        });
      }}
    >
      <CamposDatas
        inicial={{
          titulo: simulado.titulo,
          duracaoMin: simulado.duracaoMin,
          liberadoEm: paraCampoData(simulado.liberadoEm),
          encerraEm: paraCampoData(simulado.encerraEm),
        }}
      />
      <CampoGabarito inicial={simulado.gabarito.join("")} questoes={simulado.gabarito.length} />
      <CampoPdf />
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </Button>
        {simulado.temPdf && (
          <a href={`/api/simulados/${simulado.id}/pdf`} className="text-sm font-bold text-marca-clara hover:underline">
            Baixar o PDF
          </a>
        )}
        <span className="flex-1" />
        {apagar ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            Apagar o simulado{simulado.entregas ? ` e as ${simulado.entregas} entregas` : ""}?
            <Button
              type="button"
              variante="contorno"
              className="text-erro"
              disabled={enviando}
              onClick={() =>
                iniciar(async () => {
                  const r = await apagarSimulado(simulado.id);
                  if (!r.ok) setErro(r.erro);
                  else router.refresh();
                })
              }
            >
              Sim, apagar
            </Button>
            <Button type="button" variante="fantasma" onClick={() => setApagar(false)}>
              Não
            </Button>
          </span>
        ) : (
          <button type="button" onClick={() => setApagar(true)} className="text-sm font-bold text-suave hover:text-erro">
            Apagar
          </button>
        )}
      </div>
      {aviso && <p className="text-sm font-bold text-acerto sm:col-span-2">{aviso}</p>}
      {erro && <p className="text-sm font-bold text-erro sm:col-span-2">{erro}</p>}
    </form>
  );
}
