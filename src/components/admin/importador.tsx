"use client";

import { CircleCheck, CircleX, FileUp } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { classeCampo } from "@/components/campo-senha";
import { Button } from "@/components/ui/button";
import { ROTULO_DIFICULDADE } from "@/lib/dificuldade";
import { cn, formatarNumero } from "@/lib/utils";
import {
  conferirConteudo,
  importarConteudo,
  type ResultadoConferencia,
  type ResultadoImportacao,
} from "@/server/acoes-admin";

type Conferido = Extract<ResultadoConferencia, { ok: true }>;

export function Importador() {
  const [texto, setTexto] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [colar, setColar] = useState(false);
  const [conferencia, setConferencia] = useState<Conferido | null>(null);
  const [resultado, setResultado] = useState<Extract<ResultadoImportacao, { ok: true }> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const entradaArquivo = useRef<HTMLInputElement>(null);

  function recomecar() {
    setTexto("");
    setNomeArquivo(null);
    setConferencia(null);
    setResultado(null);
    setErro(null);
    if (entradaArquivo.current) entradaArquivo.current.value = "";
  }

  async function escolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setConferencia(null);
    setResultado(null);
    setErro(null);
    setNomeArquivo(arquivo.name);
    setTexto(await arquivo.text());
  }

  function conferir() {
    setErro(null);
    setConferencia(null);
    iniciar(async () => {
      const r = await conferirConteudo(texto);
      if (!r.ok) return setErro(r.erro);
      setConferencia(r);
    });
  }

  function importar() {
    setErro(null);
    iniciar(async () => {
      const r = await importarConteudo(texto);
      if (!r.ok) return setErro(r.erro);
      setResultado(r);
      setConferencia(null);
    });
  }

  if (resultado) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-lg font-extrabold text-acerto">
          <CircleCheck className="size-5" /> Importação concluída
        </p>
        <ul className="space-y-1 text-sm">
          <li>{formatarNumero(resultado.questoes)} questões novas</li>
          <li>{formatarNumero(resultado.flashcards)} flashcards novos</li>
          {resultado.jaExistiam > 0 && <li className="text-suave">{resultado.jaExistiam} já existiam (ignorados)</li>}
          {resultado.invalidos > 0 && <li className="text-erro">{resultado.invalidos} com problema (não entraram)</li>}
        </ul>
        <p className="text-sm text-suave">Já estão disponíveis para os alunos na tela Estudar.</p>
        <Button onClick={recomecar}>Importar outro arquivo</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!colar ? (
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-borda p-8 text-center transition-colors hover:border-marca hover:bg-marca-suave",
            nomeArquivo && "border-marca bg-marca-suave",
          )}
        >
          <FileUp className="size-7 text-marca-clara" aria-hidden />
          <span className="font-extrabold">{nomeArquivo ?? "Escolher o arquivo que a IA gerou"}</span>
          <span className="text-xs text-suave">.json ou .jsonl</span>
          <input
            ref={entradaArquivo}
            type="file"
            accept=".json,.jsonl,.txt,application/json"
            className="sr-only"
            onChange={(e) => escolherArquivo(e.target.files?.[0])}
          />
        </label>
      ) : (
        <textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setConferencia(null);
          }}
          rows={10}
          placeholder="Cole aqui a resposta da IA (o bloco de código json)."
          className={cn(classeCampo, "h-auto py-2.5 font-mono text-xs")}
        />
      )}
      <button
        type="button"
        onClick={() => {
          setColar((c) => !c);
          recomecar();
        }}
        className="-mt-2 block text-sm font-bold text-marca-clara hover:underline"
      >
        {colar ? "Prefiro enviar um arquivo" : "A IA respondeu em texto? Colar o conteúdo"}
      </button>

      {erro && (
        <p className="flex items-start gap-2 rounded-xl bg-erro-suave px-4 py-3 text-sm text-erro">
          <CircleX className="mt-0.5 size-4 shrink-0" /> {erro}
        </p>
      )}

      {!conferencia && (
        <Button
          onClick={conferir}
          disabled={!texto.trim() || ocupado}
          tamanho="grande"
          className="w-full shadow-[0_8px_24px_rgba(47,107,255,.4)] disabled:shadow-none sm:w-auto sm:px-10"
        >
          {ocupado ? "Conferindo..." : "Conferir arquivo"}
        </Button>
      )}

      {conferencia && <Conferencia dados={conferencia} />}

      {conferencia && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={importar}
            disabled={ocupado || conferencia.totais.questoes + conferencia.totais.flashcards === 0}
            tamanho="grande"
          >
            {ocupado
              ? "Importando..."
              : `Importar ${formatarNumero(conferencia.totais.questoes)} questões e ${formatarNumero(conferencia.totais.flashcards)} flashcards`}
          </Button>
          <Button variante="fantasma" onClick={recomecar} disabled={ocupado}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}

function Parecida({ nome }: { nome: string }) {
  return <span className="ml-1 text-destaque">(parece com &quot;{nome}&quot;, que já existe)</span>;
}

function Conferencia({ dados }: { dados: Conferido }) {
  const { totais } = dados;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { rotulo: "Questões novas", n: totais.questoes, cor: "" },
          { rotulo: "Flashcards novos", n: totais.flashcards, cor: "" },
          { rotulo: "Já existiam", n: totais.jaExistem, cor: "text-suave" },
          { rotulo: "Com problema", n: totais.invalidos, cor: totais.invalidos ? "text-erro" : "text-suave" },
        ].map((c) => (
          <div key={c.rotulo} className="rounded-xl border border-borda bg-white/5 p-3">
            <p className="text-xs font-bold text-suave">{c.rotulo}</p>
            <p className={cn("mt-1 text-2xl font-extrabold tabular-nums", c.cor)}>{formatarNumero(c.n)}</p>
          </div>
        ))}
      </div>

      {dados.porArea.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-suave">
              <tr>
                <th className="py-2 pr-3 font-bold">Área</th>
                <th className="px-2 font-bold">Fácil</th>
                <th className="px-2 font-bold">Médio</th>
                <th className="px-2 font-bold">Difícil</th>
                <th className="px-2 font-bold">Flashcards</th>
              </tr>
            </thead>
            <tbody>
              {dados.porArea.map((l) => (
                <tr key={l.area} className="border-t border-borda">
                  <td className="py-2 pr-3 font-semibold">{l.area}</td>
                  <td className="px-2 tabular-nums">{l.facil}</td>
                  <td className="px-2 tabular-nums">{l.medio}</td>
                  <td className="px-2 tabular-nums">{l.dificil}</td>
                  <td className="px-2 tabular-nums">{l.flashcards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dados.invalidos.length > 0 && (
        <details className="rounded-xl border border-erro/40 bg-erro-suave p-4 text-sm" open>
          <summary className="cursor-pointer font-extrabold text-erro">
            {totais.invalidos} {totais.invalidos === 1 ? "item não vai entrar" : "itens não vão entrar"} (veja o motivo)
          </summary>
          <ul className="mt-3 space-y-2">
            {dados.invalidos.map((i) => (
              <li key={i.posicao}>
                <span className="font-bold">Item {i.posicao}</span>
                {i.trecho && <span className="text-suave"> ({i.trecho}...)</span>}: {i.erro}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-suave">
            Pode importar mesmo assim (só os itens bons entram) ou pedir para a IA corrigir esses itens.
          </p>
        </details>
      )}

      {(dados.novas.materias.length > 0 || dados.novas.areas.length > 0) && (
        <div className="rounded-xl border border-marca/40 bg-marca-suave p-4 text-sm">
          <p className="font-extrabold text-marca-clara">Vão ser criadas</p>
          <ul className="mt-2 space-y-1">
            {dados.novas.materias.map((m) => (
              <li key={m.nome}>
                Matéria nova: <span className="font-bold">{m.nome}</span>
                {m.parecida && <Parecida nome={m.parecida} />}
              </li>
            ))}
            {dados.novas.areas.map((a) => (
              <li key={`${a.materia}::${a.nome}`}>
                Área nova em {a.materia}: <span className="font-bold">{a.nome}</span>
                {a.parecida && <Parecida nome={a.parecida} />}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-suave">
            Nomes equivalentes (maiúsculas, acentos, plural) já são unidos sozinhos. Se aparecer &quot;parece com&quot;,
            confira: se for o mesmo tema, peça para a IA usar o nome que já existe e gere o arquivo de novo.
          </p>
        </div>
      )}

      {dados.extras.areasSugeridas.length > 0 && (
        <div className="rounded-xl border border-destaque/40 bg-destaque-suave p-4 text-sm">
          <p className="font-extrabold text-destaque">A IA deixou estes temas do PDF sem questões</p>
          <p className="mt-1 text-texto/80">{dados.extras.areasSugeridas.join(", ")}</p>
          <p className="mt-2 text-xs text-suave">
            Se forem importantes, peça na mesma conversa: &quot;Gere questões também sobre esses temas&quot;.
          </p>
        </div>
      )}

      {dados.extras.pontosCobertos.length > 0 && (
        <details className="rounded-xl border border-borda bg-white/5 p-4 text-sm">
          <summary className="cursor-pointer font-extrabold">
            Pontos cobertos ({dados.extras.pontosCobertos.length}): guarde para o próximo lote
          </summary>
          <textarea
            readOnly
            rows={6}
            onFocus={(e) => e.currentTarget.select()}
            value={dados.extras.pontosCobertos
              .map((p) => `${p.area}: ${p.ponto}${p.questoes ? ` (${p.questoes})` : ""}`)
              .join("\n")}
            className={cn(classeCampo, "mt-3 h-auto py-2 font-mono text-xs")}
          />
        </details>
      )}

      {dados.amostra.length > 0 && (
        <details className="rounded-xl border border-borda bg-white/5 p-4 text-sm">
          <summary className="cursor-pointer font-extrabold">Ver amostra ({dados.amostra.length} questões)</summary>
          <div className="mt-3 space-y-5">
            {dados.amostra.map((q, i) => (
              <div key={i} className="space-y-2">
                <p className="text-xs font-bold text-suave">
                  {q.area}
                  {q.dificuldade && ` · ${ROTULO_DIFICULDADE[q.dificuldade]}`}
                </p>
                <p className="whitespace-pre-line font-semibold">{q.enunciado}</p>
                <ul className="space-y-1">
                  {q.alternativas.map((a) => (
                    <li key={a.letra} className={cn(a.letra === q.gabarito && "font-bold text-acerto")}>
                      {a.letra}) {a.texto}
                    </li>
                  ))}
                </ul>
                {q.comentario && <p className="whitespace-pre-line text-xs text-suave">{q.comentario}</p>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
