import type { Metadata } from "next";
import { EditarSimulado, NovoSimulado } from "@/components/admin/simulados";
import { CabecalhoPagina, Secao, Selo } from "@/components/admin/kit";
import { exigirAdmin } from "@/lib/sessao";
import { OPCOES_SIMULADO, type OpcoesSimulado } from "@/lib/simulados";
import { situacaoAvisos } from "@/server/avisos-simulado";
import { listarSimuladosAdmin } from "@/server/simulados";

export const metadata: Metadata = { title: "Simulados" };

const dataHora = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function PaginaSimuladosAdmin() {
  await exigirAdmin();
  const [lista, avisos] = await Promise.all([listarSimuladosAdmin(), situacaoAvisos()]);
  const agora = Date.now();
  return (
    <>
      <CabecalhoPagina
        titulo="Simulados"
        subtitulo="Da Tropa de Elite: o aluno baixa o PDF, imprime, dá o play no cronômetro e marca o gabarito aqui. O ranking sai das entregas."
      />
      <Secao titulo="Novo simulado">
        <NovoSimulado />
      </Secao>
      <Secao titulo={`Cadastrados (${lista.length})`}>
        {lista.length === 0 && <p className="px-4 pb-5 text-sm text-suave sm:px-5">Nenhum simulado ainda.</p>}
        <ul>
          {lista.map((s) => {
            const situacao = !s.arquivoNome
              ? { tom: "erro" as const, texto: "Falta o PDF" }
              : s.liberadoEm.getTime() > agora
                ? { tom: "destaque" as const, texto: `Libera ${dataHora(s.liberadoEm)}` }
                : s.encerraEm && s.encerraEm.getTime() < agora
                  ? { tom: "neutro" as const, texto: "Encerrado" }
                  : { tom: "acerto" as const, texto: "No ar" };
            return (
              <li key={s.id} className="border-t border-borda">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
                    <span className="font-bold">{s.titulo}</span>
                    <Selo tom="marca">{s.concurso}</Selo>
                    <Selo tom={situacao.tom}>{situacao.texto}</Selo>
                    <span className="text-xs text-suave">
                      {s.questoes} questões ({OPCOES_SIMULADO[s.opcoes as OpcoesSimulado]}), {s.duracaoMin} min, {s.entregas} entregas
                    </span>
                    {avisos && s.liberadoEm.getTime() <= agora && (
                      <span className="text-xs text-suave">
                        · E-mail de liberação:{" "}
                        {avisos.get(s.id)?.concluido
                          ? `enviado (${avisos.get(s.id)!.enviados})`
                          : avisos.get(s.id)
                            ? `${avisos.get(s.id)!.enviados} enviados, continua no próximo disparo`
                            : "ainda não enviado"}
                      </span>
                    )}
                  </summary>
                  <EditarSimulado
                    simulado={{
                      id: s.id,
                      titulo: s.titulo,
                      duracaoMin: s.duracaoMin,
                      liberadoEm: s.liberadoEm,
                      encerraEm: s.encerraEm,
                      gabarito: s.gabarito,
                      temPdf: !!s.arquivoNome,
                      temComentado: !!Number(s.temComentado),
                      entregas: s.entregas,
                    }}
                  />
                </details>
              </li>
            );
          })}
        </ul>
      </Secao>
    </>
  );
}
