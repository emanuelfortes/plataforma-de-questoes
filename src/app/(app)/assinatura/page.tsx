import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BotaoAssinar, BotaoCancelar, BotaoTrocarPlano } from "@/components/assinatura/botoes";
import { FormularioCartao } from "@/components/assinatura/formulario-cartao";
import { PagamentoPix } from "@/components/assinatura/pagamento-pix";
import { Card } from "@/components/ui/card";
import {
  ADICIONAL_ELITE,
  ASSINATURA,
  BENEFICIOS_ASSINATURA,
  BENEFICIOS_ELITE,
  DIAS_PIX,
  ELITE,
  formatarReais,
  LIMITE_GRATIS_DIA,
  PLANOS,
  precoDoPlano,
  PROMOCAO,
  promocaoAberta,
  valorAoTrocar,
  type Plano,
} from "@/lib/planos";
import { cn } from "@/lib/utils";
import { exigirUsuario } from "@/lib/sessao";
import {
  acessoLiberado,
  assinaturaDoUsuario,
  atualizarPixPendentes,
  cobrancaAtiva,
  ehMonitor,
  ehPix,
  eliteLiberado,
  pausaDoCartao,
  precoDoPix,
  sincronizarAssinatura,
  situacaoDoAluno,
} from "@/server/assinatura";

export const metadata: Metadata = { title: "Assinatura" };

const BENEFICIOS = [...BENEFICIOS_ASSINATURA, "Cancele quando quiser, direto aqui"];

const dataCurta = (d: Date | null | undefined) => (d ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
const fimDaPromocao = PROMOCAO.ate.split("-").reverse().join("/");

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

  if (await ehMonitor(usuario.id)) {
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">Assinatura</p>
        <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-[-.03em]">Você é monitor.</h1>
        <p className="text-sm text-suave">
          Seu acesso é completo e sem custo: questões sem limite, flashcards, desempenho, Vade Mecum e os simulados da{" "}
          {ELITE.nome}. Não precisa assinar.
        </p>
      </div>
    );
  }

  // Confirma na hora, sem esperar o aviso do Mercado Pago (que pode demorar uns minutos).
  if (preapproval_id && /^[\w-]{1,64}$/.test(preapproval_id)) {
    await sincronizarAssinatura(preapproval_id).catch((erro) => console.error("[assinatura] retorno:", erro));
  }

  // Pix pago sem o aviso chegar (ou com a tela fechada): confere os que ainda aguardam.
  await atualizarPixPendentes(usuario.id);

  const [a, situacao, pixBasico, pixElite, pausaCartao] = await Promise.all([
    assinaturaDoUsuario(usuario.id),
    situacaoDoAluno(usuario),
    precoDoPix(usuario.id, "basico"),
    precoDoPix(usuario.id, "elite"),
    pausaDoCartao(),
  ]);
  const liberado = acessoLiberado(a);
  const elite = eliteLiberado(a);
  const promocao = promocaoAberta();
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
                . Quer só as questões? Volte para o Basic ({formatarReais(valorAoTrocar(a.valorCentavos, "basico") / 100)}
                /mês) a partir da próxima cobrança.
              </p>
              <BotaoTrocarPlano plano="basico" rotulo="Voltar para o Basic" />
            </div>
          ) : (
            <div className="space-y-3 border-t border-acerto/30 pt-4 text-sm text-texto/85">
              <p>
                <strong>{ELITE.nome}:</strong> {BENEFICIOS_ELITE.slice(1).join("; ")}. Por mais{" "}
                {formatarReais(ADICIONAL_ELITE)}/mês (total de {formatarReais(valorAoTrocar(a.valorCentavos, "elite") / 100)}/mês): os simulados
                liberam agora e o novo valor vale a partir da próxima cobrança.
              </p>
              <BotaoTrocarPlano plano="elite" rotulo="Incluir a Tropa de Elite" />
            </div>
          )}
          <BotaoCancelar />
        </Card>
      )}

      {a && ehPix(a.id) && liberado && (
        <Card className="space-y-2 border-acerto/40 bg-acerto-suave p-6">
          <p className="font-extrabold text-acerto">{elite ? ELITE.nome : ASSINATURA.nome} ativo (Pix)</p>
          <p className="text-sm text-texto/85">
            Seu acesso vai até <strong>{dataCurta(a.acessoAte)}</strong>. Para não parar, pague o próximo Pix antes dessa
            data: os {DIAS_PIX} dias novos começam quando os atuais acabarem, então renovar antes não perde nenhum dia.
            Avisamos por e-mail perto do fim.
          </p>
        </Card>
      )}

      {a && !ehPix(a.id) && a.status !== "authorized" && liberado && (
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

      {a?.status !== "authorized" && (
        <div className="space-y-4">
          {promocao && (
            <p className="rounded-2xl border border-destaque/50 bg-destaque-suave px-4 py-3 text-sm font-bold text-destaque">
              {PROMOCAO.nome}: assinando até {fimDaPromocao}, você paga o valor promocional para sempre, enquanto
              mantiver a assinatura.
            </p>
          )}
          {(["basico", "elite"] as const).map((plano) => (
            <CartaoPlano
              key={plano}
              plano={plano}
              valor={precoDoPlano(plano)}
              valorPix={plano === "elite" ? pixElite : pixBasico}
              renovando={!!a && ehPix(a.id) && liberado}
              chavePublica={chavePublica}
              pausaCartao={pausaCartao}
              email={usuario.email}
              rotulo={a?.status === "pending" && !ehPix(a.id) ? "Concluir pagamento" : `Assinar por ${formatarReais(precoDoPlano(plano))}/mês`}
            />
          ))}
          <p className="text-xs leading-relaxed text-suave">
            Pagamento seguro pelo Mercado Pago. No cartão de crédito, a cobrança é automática todo mês e você pode
            cancelar quando quiser; no Pix, cada pagamento vale {DIAS_PIX} dias e não renova sozinho. Você tem 7 dias
            para desistir com reembolso.
            {promocao && " Se cancelar e assinar de novo depois da promoção, vale o preço normal."} Veja os{" "}
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

/** Um plano mensal: preço (com o normal riscado na promoção), o que inclui e o pagamento. */
function CartaoPlano({
  plano,
  valor,
  valorPix,
  renovando,
  chavePublica,
  pausaCartao,
  email,
  rotulo,
}: {
  plano: Plano;
  valor: number;
  /** Preço do Pix: o que o aluno já paga, se estiver renovando (ver precoDoPix). */
  valorPix: number;
  renovando: boolean;
  chavePublica?: string;
  /** Recusa recente do antifraude neste aparelho: até quando o cartão fica pausado (ver pausaDoCartao). */
  pausaCartao: Date | null;
  email: string;
  rotulo: string;
}) {
  const elite = plano === "elite";
  const normal = PLANOS[plano].valor;
  return (
    <Card className={cn("space-y-5 p-6", elite && "border-2 border-marca")}>
      <div>
        <p className={cn("text-sm font-bold", elite ? "uppercase text-marca-clara" : "text-suave")}>
          {elite ? "🏆 " : "✅ "}
          {PLANOS[plano].nome}
        </p>
        {elite ? (
          <>
            <p className="mt-1 text-sm text-suave">Inclua 2 simulados exclusivos por apenas</p>
            <p className="text-4xl font-extrabold tracking-tight">
              + {formatarReais(ADICIONAL_ELITE)}
              <span className="text-base font-bold text-suave"> /mês</span>
            </p>
            <p className="mt-1 text-sm text-suave">
              Total com o Basic: <strong className="text-texto">{formatarReais(valor)}/mês</strong>
              {valor < normal && <span className="ml-1.5 line-through">{formatarReais(normal)}</span>}
            </p>
          </>
        ) : (
          <>
            {valor < normal && (
              <p className="mt-1 text-sm font-bold text-suave">
                De <span className="line-through">{formatarReais(normal)}/mês</span>
              </p>
            )}
            <p className="mt-1 text-4xl font-extrabold tracking-tight">
              {valor < normal && <span className="text-base font-bold text-suave">Por </span>}
              {formatarReais(valor)}
              <span className="text-base font-bold text-suave"> /mês</span>
            </p>
          </>
        )}
      </div>
      <ul className="space-y-2 text-sm">
        {(elite ? BENEFICIOS_ELITE : BENEFICIOS).map((b) => (
          <li key={b} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-acerto" aria-hidden />
            {b}
          </li>
        ))}
      </ul>
      {/* Com a Public Key, o cartão é digitado aqui (checkout transparente); sem ela, vai para o Mercado Pago. */}
      {pausaCartao ? (
        <p className="rounded-xl border border-erro/40 bg-erro-suave p-4 text-sm leading-relaxed">
          <strong className="text-erro">O Mercado Pago recusou o cartão por segurança.</strong> Tentar de novo agora
          costuma dar a mesma recusa, então o cartão volta às{" "}
          {pausaCartao.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}.
          Pague com Pix aqui embaixo: libera na hora.
        </p>
      ) : chavePublica ? (
        <FormularioCartao chavePublica={chavePublica} email={email} rotulo={rotulo} plano={plano} valor={valor} />
      ) : (
        <BotaoAssinar rotulo={rotulo} plano={plano} />
      )}
      <div className="space-y-3 border-t border-borda pt-4">
        <p className="text-sm text-suave">
          {renovando ? "Renove com Pix:" : "Prefere Pix?"} {formatarReais(valorPix)} por {DIAS_PIX} dias, sem renovação
          automática.
        </p>
        <PagamentoPix plano={plano} valor={valorPix} rotulo="Pagar com Pix" />
      </div>
    </Card>
  );
}
