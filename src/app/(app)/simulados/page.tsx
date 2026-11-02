import { Check, ChevronRight, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { variantesBotao } from "@/components/ui/button";
import { ADICIONAL_ELITE, BENEFICIOS_ELITE, ELITE, formatarReais, precoDoPlano } from "@/lib/planos";
import { exigirUsuario } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import { temElite } from "@/server/assinatura";
import { encerrado, listarSimuladosAluno } from "@/server/simulados";

export const metadata: Metadata = { title: "Simulados" };

const dataCurta = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default async function PaginaSimulados() {
  const usuario = await exigirUsuario();
  const elite = await temElite(usuario);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">Tropa de Elite</p>
        <h1 className="mt-1 text-[34px] font-extrabold leading-[1.1] tracking-[-.03em]">Simulados</h1>
        <p className="mt-2 text-sm text-suave">
          Baixe o PDF, imprima e faça como no dia da prova. Aqui você dá o play no cronômetro, marca o gabarito e vê sua
          posição entre os assinantes da Tropa de Elite.
        </p>
      </div>
      {elite ? <Lista usuarioId={usuario.id} /> : <ConviteElite />}
    </div>
  );
}

async function Lista({ usuarioId }: { usuarioId: string }) {
  const lista = await listarSimuladosAluno(usuarioId);
  if (!lista.length) {
    return <Card className="p-6 text-sm text-suave">O próximo simulado sai em breve. Quando for liberado, ele aparece aqui.</Card>;
  }
  return (
    <ul className="space-y-3">
      {lista.map((s) => {
        const situacao = s.entregueEm
          ? { tom: "text-acerto", texto: `Entregue: ${s.acertos} de ${s.questoes}` }
          : s.iniciadoEm
            ? { tom: "text-destaque", texto: "Em andamento" }
            : encerrado(s)
              ? { tom: "text-suave", texto: "Encerrado" }
              : { tom: "text-marca-clara", texto: "Disponível" };
        return (
          <li key={s.id}>
            <Link
              href={`/simulados/${s.id}`}
              className="flex items-center gap-4 rounded-2xl border border-borda bg-superficie p-4 transition-colors hover:bg-camada"
            >
              <FileText className="size-8 shrink-0 text-marca-clara" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[.06em] text-suave">{s.concurso}</p>
                <p className="font-extrabold">{s.titulo}</p>
                <p className="text-xs text-suave">
                  {s.questoes} questões, {s.duracaoMin} min, liberado em {dataCurta(s.liberadoEm)}
                  {s.encerraEm && `, até ${dataCurta(s.encerraEm)}`}
                </p>
                <p className={cn("mt-1 text-sm font-bold", situacao.tom)}>{situacao.texto}</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-suave" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ConviteElite() {
  return (
    <Card className="space-y-5 border-2 border-marca p-6">
      <div>
        <p className="text-sm font-bold uppercase text-marca-clara">🏆 {ELITE.nome}</p>
        <p className="mt-1 text-sm text-suave">Inclua 2 simulados exclusivos por apenas</p>
        <p className="text-4xl font-extrabold tracking-tight">
          + {formatarReais(ADICIONAL_ELITE)}
          <span className="text-base font-bold text-suave"> /mês</span>
        </p>
        <p className="mt-1 text-sm text-suave">
          Total com o Basic: <strong className="text-texto">{formatarReais(precoDoPlano("elite"))}/mês</strong>
          {precoDoPlano("elite") < ELITE.valor && <span className="ml-1.5 line-through">{formatarReais(ELITE.valor)}</span>}
        </p>
      </div>
      <ul className="space-y-2 text-sm">
        {BENEFICIOS_ELITE.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-acerto" aria-hidden />
            {b}
          </li>
        ))}
      </ul>
      <Link href="/assinatura" className={variantesBotao({ tamanho: "grande", className: "w-full sm:w-auto sm:px-10" })}>
        Quero a Tropa de Elite
      </Link>
    </Card>
  );
}
