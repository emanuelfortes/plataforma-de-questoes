import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BotaoAssinar, BotaoCancelar, BotaoTrocarPlano } from "@/components/assinatura/botoes";
import { FormularioCartao } from "@/components/assinatura/formulario-cartao";
import { Card } from "@/components/ui/card";
import {
  ASSINATURA,
  BENEFICIOS_ASSINATURA,
  BENEFICIOS_ELITE,
  BLACK_FRIDAY,
  blackFridayAberta,
  ELITE,
  formatarReais,
  LIMITE_GRATIS_DIA,
  PLANOS,
  type Plano,
} from "@/lib/planos";
import { cn } from "@/lib/utils";
import { exigirUsuario } from "@/lib/sessao";
import {
  acessoLiberado,
  assinaturaDoUsuario,
  cobrancaAtiva,
  ehCompra,
  eliteLiberado,
  jaComprouBlackFriday,
  procurarComprasDoUsuario,
  sincronizarAssinatura,
  sincronizarCompra,
  situacaoDoAluno,
} from "@/server/assinatura";

export const metadata: Metadata = { title: "Assinatura" };

const BENEFICIOS = [...BENEFICIOS_ASSINATURA, "Cancele quando quiser, direto aqui"];

const dataCurta = (d: Date | null | undefined) => (d ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");

// O Mercado Pago devolve o aluno para cá com ?preapproval_id=... (assinatura) ou ?payment_id=... (Black Friday).
export default async function PaginaAssinatura({
  searchParams,
}: {
  searchParams: Promise<{ preapproval_id?: string; payment_id?: string }>;
}) {
  const usuario = await exigirUsuario();
  const { preapproval_id, payment_id } = await searchParams;

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
  // Só o id: o pagamento é buscado na API (e só vale se a referência for deste aluno, conferido abaixo).
  if (payment_id && /^\d{1,20}$/.test(payment_id)) {
    await sincronizarCompra(payment_id).catch((erro) => console.error("[assinatura] retorno da compra:", erro));
  }

  let a = await assinaturaDoUsuario(usuario.id);
  // Sem acesso: confere se há Pix da Black Friday pago sem ter voltado ao site.
  if (!acessoLiberado(a)) {
    await procurarComprasDoUsuario(usuario.id).catch((erro) => console.error("[assinatura] busca de compras:", erro));
    a = await assinaturaDoUsuario(usuario.id);
  }
  const [situacao, comprou] = await Promise.all([situacaoDoAluno(usuario), jaComprouBlackFriday(usuario.id)]);
  const liberado = acessoLiberado(a);
  const compra = a && ehCompra(a.id) ? a : null;
  const ofertaBlackFriday = blackFridayAberta() && !comprou && !liberado;
  const elite = eliteLiberado(a);
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
          <p className="font-extrabold text-acerto">{elite ? ELITE.nome : ASSINATURA.nome} ativo</p>
          <p className="text-sm text-texto/85">
            {formatarReais(a.valorCentavos / 100)} por mês, no cartão.
            {a.acessoAte && ` Próxima cobrança em ${dataCurta(a.acessoAte)}.`}
          </p>
          {elite ? (
            <div className="space-y-2 border-t border-acerto/30 pt-4 text-sm text-texto/85">
              <p>
                Seus simulados estão em{" "}
                <Link href="/simulados" className="font-bold text-marca-clara hover:underline">
                  Simulados
                </Link>
                . Quer só as questões? Volte para o Basic ({formatarReais(ASSINATURA.valor)}/mês) a partir da próxima
                cobrança.
              </p>
              <BotaoTrocarPlano plano="basico" rotulo="Voltar para o Basic" />
            </div>
          ) : (
            <div className="space-y-3 border-t border-acerto/30 pt-4 text-sm text-texto/85">
              <p>
                <strong>Elite:</strong> {BENEFICIOS_ELITE.slice(1).join("; ")}. Por {formatarReais(ELITE.valor)}/mês: os
                simulados liberam agora e o novo valor vale a partir da próxima cobrança.
              </p>
              <BotaoTrocarPlano plano="elite" rotulo="Mudar para o Elite" />
            </div>
          )}
          <BotaoCancelar />
        </Card>
      )}

      {compra && liberado && (
        <Card className="space-y-4 border-acerto/40 bg-acerto-suave p-6">
          <p className="font-extrabold text-acerto">Black Friday ativa</p>
          <p className="text-sm text-texto/85">Seu acesso completo vai até {dataCurta(compra.acessoAte)}.</p>
          <p className="border-t border-acerto/30 pt-4 text-sm text-texto/85">
            Quer continuar depois? Escolha um plano abaixo. No Basic, a primeira cobrança só acontece em{" "}
            {dataCurta(compra.acessoAte)}, quando a Black Friday acabar. O Elite começa hoje, já com os simulados.
          </p>
        </Card>
      )}

      {compra && (compra.status === "pending" || compra.status === "in_process") && (
        <Card className="space-y-2 border-destaque/40 bg-destaque-suave p-6">
          <p className="font-extrabold text-destaque">Aguardando a confirmação do pagamento</p>
          <p className="text-sm text-texto/85">
            Se você pagou com Pix ou boleto, a liberação acontece assim que o Mercado Pago confirmar. Atualize esta
            página daqui a pouco.
          </p>
        </Card>
      )}

      {ofertaBlackFriday && (
        <Card className="space-y-4 border-destaque/50 p-6">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[.06em] text-destaque">⚠️ Black Friday</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight">
              {formatarReais(BLACK_FRIDAY.valor)}
              <span className="text-base font-bold text-suave"> por 2 meses</span>
            </p>
            <p className="mt-1 text-sm text-suave">
              Cada mês sai por {formatarReais(BLACK_FRIDAY.valor / 2)}. Paga uma vez, no Pix ou no cartão, sem
              renovação automática. Oferta até {BLACK_FRIDAY.ate.split("-").reverse().join("/")}.
            </p>
          </div>
          <BotaoAssinar blackFriday rotulo="Quero a Black Friday" />
        </Card>
      )}

      {a && !compra && a.status !== "authorized" && liberado && (
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

      {(!liberado || (compra && liberado)) && (
        <div className="space-y-4">
          {(["basico", "elite"] as const).map((plano) => (
            <CartaoPlano
              key={plano}
              plano={plano}
              chavePublica={chavePublica}
              email={usuario.email}
              rotulo={
                compra && liberado
                  ? plano === "basico"
                    ? "Continuar no Basic"
                    : "Ir para o Elite"
                  : a?.status === "pending"
                    ? "Concluir pagamento"
                    : `Assinar o ${plano === "elite" ? "Elite" : "Basic"}`
              }
            />
          ))}
          <p className="text-xs leading-relaxed text-suave">
            Pagamento seguro pelo Mercado Pago, com cobrança automática todo mês no cartão de crédito. Você pode
            cancelar quando quiser e tem 7 dias para desistir com reembolso. Veja os{" "}
            <Link href="/termos" className="font-bold text-marca-clara hover:underline">
              Termos de uso
            </Link>
            .
          </p>
        </div>
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

/** Um plano mensal: preço, o que inclui e o pagamento (cartão aqui ou checkout do Mercado Pago). */
function CartaoPlano({ plano, chavePublica, email, rotulo }: { plano: Plano; chavePublica?: string; email: string; rotulo: string }) {
  const elite = plano === "elite";
  const itens = elite ? BENEFICIOS_ELITE : BENEFICIOS;
  return (
    <Card className={cn("space-y-5 p-6", elite && "border-2 border-marca")}>
      <div>
        <p className={cn("text-sm font-bold", elite ? "text-marca-clara" : "text-suave")}>
          {elite ? "🏆 " : "✅ "}
          {PLANOS[plano].nome}
        </p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">
          {formatarReais(PLANOS[plano].valor)}
          <span className="text-base font-bold text-suave"> /mês</span>
        </p>
      </div>
      <ul className="space-y-2 text-sm">
        {itens.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-acerto" aria-hidden />
            {b}
          </li>
        ))}
      </ul>
      {/* Com a Public Key, o cartão é digitado aqui (checkout transparente); sem ela, vai para o Mercado Pago. */}
      {chavePublica ? (
        <FormularioCartao chavePublica={chavePublica} email={email} rotulo={rotulo} plano={plano} />
      ) : (
        <BotaoAssinar rotulo={rotulo} plano={plano} />
      )}
    </Card>
  );
}
