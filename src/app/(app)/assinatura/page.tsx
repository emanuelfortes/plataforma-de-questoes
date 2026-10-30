import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BotaoAssinar, BotaoCancelar } from "@/components/assinatura/botoes";
import { FormularioCartao } from "@/components/assinatura/formulario-cartao";
import { Card } from "@/components/ui/card";
import { ASSINATURA, formatarReais, LIMITE_GRATIS_DIA } from "@/lib/planos";
import { exigirUsuario } from "@/lib/sessao";
import {
  acessoLiberado,
  assinaturaDoUsuario,
  cobrancaAtiva,
  sincronizarAssinatura,
  situacaoDoAluno,
} from "@/server/assinatura";

export const metadata: Metadata = { title: "Assinatura" };

const BENEFICIOS = [
  "Questões ilimitadas, todos os dias",
  "Flashcards com revisão no momento certo",
  "Desempenho por período e por matéria",
  "Cancele quando quiser, direto aqui",
];

const dataCurta = (d: Date | null | undefined) => (d ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");

// O Mercado Pago devolve o aluno para cá com ?preapproval_id=... depois do checkout.
export default async function PaginaAssinatura({
  searchParams,
}: {
  searchParams: Promise<{ preapproval_id?: string }>;
}) {
  const usuario = await exigirUsuario();
  const { preapproval_id } = await searchParams;

  if (!cobrancaAtiva()) {
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">Assinatura</p>
        <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-[-.03em]">Em breve.</h1>
        <p className="text-sm text-suave">Por enquanto, todo o conteúdo está liberado sem limite.</p>
      </div>
    );
  }

  // Confirma na hora, sem esperar o aviso do Mercado Pago (que pode demorar uns minutos).
  if (preapproval_id && /^[\w-]{1,64}$/.test(preapproval_id)) {
    await sincronizarAssinatura(preapproval_id).catch((erro) => console.error("[assinatura] retorno:", erro));
  }

  const [a, situacao] = await Promise.all([assinaturaDoUsuario(usuario.id), situacaoDoAluno(usuario)]);
  const liberado = acessoLiberado(a);
  const chavePublica = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">Assinatura</p>
        <h1 className="mt-1 text-[34px] font-extrabold leading-[1.1] tracking-[-.03em]">
          {liberado ? "Você é assinante." : "Estude sem limite."}
        </h1>
      </div>

      {a?.status === "authorized" && (
        <Card className="space-y-4 border-acerto/40 bg-acerto-suave p-6">
          <p className="font-extrabold text-acerto">Assinatura ativa</p>
          <p className="text-sm text-texto/85">
            {formatarReais(a.valorCentavos / 100)} por mês, no cartão.
            {a.acessoAte && ` Próxima cobrança em ${dataCurta(a.acessoAte)}.`}
          </p>
          <BotaoCancelar />
        </Card>
      )}

      {a && a.status !== "authorized" && liberado && (
        <Card className="space-y-2 p-6">
          <p className="font-extrabold">Assinatura cancelada</p>
          <p className="text-sm text-texto/85">
            Seu acesso continua até {dataCurta(a.acessoAte)}. Depois disso, volta o limite de {LIMITE_GRATIS_DIA}{" "}
            questões por dia.
          </p>
        </Card>
      )}

      {a?.status === "pending" && preapproval_id && (
        <Card className="space-y-2 border-destaque/40 bg-destaque-suave p-6">
          <p className="font-extrabold text-destaque">Aguardando a confirmação do pagamento</p>
          <p className="text-sm text-texto/85">
            Se você concluiu o pagamento, a liberação costuma levar poucos minutos. Atualize esta página daqui a
            pouco.
          </p>
        </Card>
      )}

      {!liberado && (
        <Card className="space-y-5 p-6">
          <div>
            <p className="text-sm font-bold text-suave">{ASSINATURA.nome}</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight">
              {formatarReais(ASSINATURA.valor)}
              <span className="text-base font-bold text-suave"> /mês</span>
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            {BENEFICIOS.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-acerto" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
          {/* Com a Public Key, o cartão é digitado aqui (checkout transparente); sem ela, vai para o Mercado Pago. */}
          {chavePublica ? (
            <FormularioCartao chavePublica={chavePublica} email={usuario.email} rotulo="Assinar agora" />
          ) : (
            <BotaoAssinar rotulo={a?.status === "pending" ? "Concluir pagamento" : "Assinar agora"} />
          )}
          <p className="text-xs leading-relaxed text-suave">
            Pagamento seguro pelo Mercado Pago, com cobrança automática todo mês no cartão de crédito. Você pode
            cancelar quando quiser e tem 7 dias para desistir com reembolso. Veja os{" "}
            <Link href="/termos" className="font-bold text-marca-clara hover:underline">
              Termos de uso
            </Link>
            .
          </p>
        </Card>
      )}

      {!situacao.assinante && (
        <p className="text-center text-sm text-suave">
          Sem assinatura: {Math.min(situacao.respondidasHoje, LIMITE_GRATIS_DIA)} de {LIMITE_GRATIS_DIA} questões
          grátis usadas hoje.
        </p>
      )}
    </div>
  );
}
