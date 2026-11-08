"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ComponentProps, type FormEvent } from "react";
import { classeCampo } from "@/components/campo-senha";
import { Button } from "@/components/ui/button";
import { cepValido, cpfValido, soDigitos, telefoneValido, UFS } from "@/lib/documentos";
import type { Plano } from "@/lib/planos";
import { cn } from "@/lib/utils";
import { assinarCartaoEfi, registrarFalhaCartao } from "@/server/acoes-assinatura";

// Cartão de crédito pela Efí: os dados do cartão viram um payment_token aqui no navegador (biblioteca oficial
// payment-token-efi, que também coleta a impressão do aparelho para o antifraude). O número do cartão nunca vai
// para o nosso servidor; só o token e os dados do titular que a Efí exige (CPF, nascimento, celular e endereço).

type Campos = Record<
  "numero" | "titular" | "validade" | "cvv" | "nome" | "cpf" | "nascimento" | "celular" | "cep" | "rua" | "num" | "bairro" | "cidade" | "uf" | "complemento",
  string
>;

const VAZIO: Campos = {
  numero: "", titular: "", validade: "", cvv: "", nome: "", cpf: "", nascimento: "", celular: "",
  cep: "", rua: "", num: "", bairro: "", cidade: "", uf: "", complemento: "",
};

// Máscaras simples enquanto digita.
const mascaras: Partial<Record<keyof Campos, (v: string) => string>> = {
  numero: (v) => soDigitos(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 "),
  validade: (v) => soDigitos(v).slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2"),
  cvv: (v) => soDigitos(v).slice(0, 4),
  cpf: (v) => soDigitos(v).slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2").replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2"),
  celular: (v) => soDigitos(v).slice(0, 11).replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d)(\d{4})$/, "$1-$2"),
  cep: (v) => soDigitos(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2"),
  uf: (v) => v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2),
};

/** Navegador interno de app (Instagram, WhatsApp...): o script do antifraude costuma falhar nele. */
function navegadorDeApp() {
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|WhatsApp|TikTok|musical_ly|BytedanceWebview|Line\/|Snapchat|Twitter/i.test(navigator.userAgent);
}

/** Mensagem quando o cartão não vira token (dados do cartão, ou o Safari bloqueando o antifraude). */
function mensagemFalhaToken(bloqueado: boolean, detalhe?: string) {
  const motivo = detalhe ? ` (${detalhe.slice(0, 140)})` : "";
  if (bloqueado) {
    return `Seu navegador bloqueou a verificação de segurança do pagamento${motivo}. No iPhone, abra o site no Chrome, ou no Safari desligue em Ajustes > Apps > Safari > Avançado a "Proteção avançada contra rastreamento" e os bloqueadores de conteúdo. Ou pague com Pix.`;
  }
  return `Não foi possível validar o cartão${motivo}. Confira o número, a validade, o CVV e o CPF do titular.`;
}

function conferir(c: Campos) {
  const [mes, ano] = c.validade.split("/");
  const agora = new Date();
  const anoCheio = 2000 + Number(ano);
  if (soDigitos(c.numero).length < 13) return "Confira o número do cartão.";
  if (c.titular.trim().split(/\s+/).length < 2) return "Escreva o nome como está impresso no cartão.";
  if (!mes || !ano || Number(mes) < 1 || Number(mes) > 12 || anoCheio < agora.getFullYear() || (anoCheio === agora.getFullYear() && Number(mes) < agora.getMonth() + 1)) {
    return "Confira a validade do cartão (MM/AA).";
  }
  if (c.cvv.length < 3) return "Confira o código de segurança (CVV).";
  if (c.nome.trim().split(/\s+/).length < 2) return "Escreva o nome completo do titular.";
  if (!cpfValido(c.cpf)) return "CPF do titular inválido.";
  if (!c.nascimento) return "Informe a data de nascimento do titular.";
  if (!telefoneValido(c.celular)) return "Confira o celular com DDD.";
  if (!cepValido(c.cep)) return "Confira o CEP.";
  if (!c.rua.trim() || !c.num.trim() || !c.bairro.trim() || !c.cidade.trim()) return "Preencha o endereço de cobrança.";
  if (!(UFS as readonly string[]).includes(c.uf)) return "Confira a UF (ex.: CE).";
  return null;
}

export function FormularioCartaoEfi({
  conta,
  ambiente,
  rotulo,
  plano = "basico",
}: {
  /** Identificador de conta da Efí (público). */
  conta: string;
  ambiente: "production" | "sandbox";
  rotulo: string;
  plano?: Plano;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [c, setC] = useState<Campos>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState<null | "ativa" | "aguardando">(null);
  // Só depois de montar (no servidor não há navigator).
  const [dentroDeApp, setDentroDeApp] = useState(false);
  useEffect(() => setDentroDeApp(navegadorDeApp()), []);

  const mudar = (campo: keyof Campos) => (e: { target: { value: string } }) => {
    const valor = mascaras[campo]?.(e.target.value) ?? e.target.value;
    setC((atual) => ({ ...atual, [campo]: valor }));
    if (campo === "cep" && soDigitos(valor).length === 8) buscarCep(soDigitos(valor));
  };

  // Preenche o endereço pelo CEP (ViaCEP, público). Se falhar, o aluno digita.
  async function buscarCep(cep: string) {
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (d.erro) return;
      setC((atual) => ({
        ...atual,
        rua: atual.rua || d.logradouro || "",
        bairro: atual.bairro || d.bairro || "",
        cidade: d.localidade || atual.cidade,
        uf: d.uf || atual.uf,
      }));
    } catch {
      // sem internet ou ViaCEP fora: segue manual
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const problema = conferir(c);
    if (problema) return setErro(problema);
    setEnviando(true);
    let bloqueado = false;
    try {
      // Carrega a biblioteca da Efí só na hora de pagar.
      const EfiPay = (await import("payment-token-efi")).default;
      // Script de antifraude (ClearSale) bloqueado: o Safari bloqueia por padrão em vários casos (proteção contra
      // rastreamento, Retransmissão Privada, bloqueadores). Não desiste: tenta gerar o token mesmo assim e registra.
      bloqueado = await EfiPay.CreditCard.isScriptBlocked().catch(() => true);
      const numero = soDigitos(c.numero);
      const bandeira = await EfiPay.CreditCard.setCardNumber(numero).verifyCardBrand();
      if (!bandeira || bandeira === "undefined" || bandeira === "unsupported") return setErro("Bandeira do cartão não aceita. Tente outro cartão ou pague com Pix.");
      const [mes = "", ano = ""] = c.validade.split("/");
      const r = await EfiPay.CreditCard.setAccount(conta)
        .setEnvironment(ambiente)
        .setCreditCardData({
          brand: bandeira,
          number: numero,
          cvv: c.cvv,
          expirationMonth: mes,
          expirationYear: `20${ano}`,
          holderName: c.titular.trim(),
          holderDocument: soDigitos(c.cpf),
          reuse: true, // assinatura: a Efí cobra o mesmo cartão todo mês
        })
        .getPaymentToken();
      if (!("payment_token" in r)) {
        console.error("[efi] token do cartão:", r);
        await registrarFalhaCartao({ etapa: "token", bloqueado, detalhe: String(r.error_description ?? r.error ?? "") }).catch(() => null);
        return setErro(mensagemFalhaToken(bloqueado, r.error_description));
      }
      const resposta = await assinarCartaoEfi({
        token: r.payment_token,
        plano,
        nome: c.nome,
        cpf: c.cpf,
        nascimento: c.nascimento,
        celular: c.celular,
        cep: c.cep,
        rua: c.rua,
        numero: c.num,
        bairro: c.bairro,
        cidade: c.cidade,
        uf: c.uf,
        complemento: c.complemento || undefined,
        antifraudeBloqueado: bloqueado,
      });
      if (!resposta.ok) return setErro(resposta.erro);
      setSucesso(resposta.ativa ? "ativa" : "aguardando");
      router.refresh();
    } catch (falha) {
      console.error("[efi] formulário do cartão:", falha);
      const detalhe = (falha as { error_description?: string; message?: string })?.error_description ?? (falha as Error)?.message ?? String(falha);
      await registrarFalhaCartao({ etapa: "formulario", bloqueado, detalhe: String(detalhe) }).catch(() => null);
      setErro(mensagemFalhaToken(bloqueado, detalhe));
    } finally {
      setEnviando(false);
    }
  }

  if (sucesso) {
    return (
      <p className="rounded-xl border border-acerto/40 bg-acerto-suave p-4 text-sm font-bold text-acerto">
        {sucesso === "ativa" ? "Pagamento aprovado. Sua assinatura está ativa!" : "Recebemos o seu cartão. A confirmação costuma levar poucos minutos."}
      </p>
    );
  }

  const avisoApp = dentroDeApp && (
    <p className="rounded-xl border border-destaque/40 bg-destaque-suave p-3 text-sm leading-relaxed">
      <strong className="text-destaque">Você abriu o site dentro de um app.</strong> Para pagar no cartão, abra no Chrome ou no Safari
      (toque nos três pontinhos e em &quot;Abrir no navegador&quot;). Ou pague com Pix logo abaixo, que libera na hora.
    </p>
  );

  if (!aberto) {
    return (
      <div className="space-y-3">
        {avisoApp}
        <Button tamanho="grande" className="w-full shadow-lg shadow-marca/30 sm:w-auto sm:px-10" onClick={() => setAberto(true)}>
          {rotulo}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-5 text-sm" noValidate>
      {avisoApp}
      <fieldset className="space-y-3">
        <legend className="mb-2 font-extrabold">Cartão de crédito</legend>
        <Campo rotulo="Número do cartão" value={c.numero} onChange={mudar("numero")} inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" />
        <Campo rotulo="Nome impresso no cartão" value={c.titular} onChange={mudar("titular")} autoComplete="cc-name" autoCapitalize="characters" />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Validade" value={c.validade} onChange={mudar("validade")} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" />
          <Campo rotulo="CVV" value={c.cvv} onChange={mudar("cvv")} inputMode="numeric" autoComplete="cc-csc" placeholder="123" />
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-borda pt-4">
        <legend className="mb-2 font-extrabold">Titular do cartão</legend>
        <Campo rotulo="Nome completo" value={c.nome} onChange={mudar("nome")} autoComplete="name" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="CPF" value={c.cpf} onChange={mudar("cpf")} inputMode="numeric" placeholder="000.000.000-00" />
          <Campo rotulo="Nascimento" type="date" value={c.nascimento} onChange={mudar("nascimento")} autoComplete="bday" />
        </div>
        <Campo rotulo="Celular com DDD" value={c.celular} onChange={mudar("celular")} inputMode="tel" autoComplete="tel-national" placeholder="(85) 99999-9999" />
      </fieldset>

      <fieldset className="space-y-3 border-t border-borda pt-4">
        <legend className="mb-2 font-extrabold">Endereço de cobrança</legend>
        <Campo rotulo="CEP" value={c.cep} onChange={mudar("cep")} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" />
        <Campo rotulo="Rua" value={c.rua} onChange={mudar("rua")} autoComplete="address-line1" />
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <Campo rotulo="Número" value={c.num} onChange={mudar("num")} />
          <Campo rotulo="Complemento" value={c.complemento} onChange={mudar("complemento")} autoComplete="address-line2" />
        </div>
        <Campo rotulo="Bairro" value={c.bairro} onChange={mudar("bairro")} />
        <div className="grid grid-cols-[3fr_1fr] gap-3">
          <Campo rotulo="Cidade" value={c.cidade} onChange={mudar("cidade")} autoComplete="address-level2" />
          <Campo rotulo="UF" value={c.uf} onChange={mudar("uf")} autoComplete="address-level1" />
        </div>
      </fieldset>

      {erro && <p className="font-bold text-erro">{erro}</p>}
      <Button type="submit" tamanho="grande" className="w-full shadow-lg shadow-marca/30" disabled={enviando}>
        <Lock className="size-4" aria-hidden />
        {enviando ? "Processando o pagamento..." : "Assinar"}
      </Button>
      <p className="text-xs text-suave">Pagamento processado pela Efí. Os dados do cartão são criptografados no seu aparelho e não ficam com a gente.</p>
    </form>
  );
}

function Campo({ rotulo, className, ...props }: ComponentProps<"input"> & { rotulo: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="font-medium">{rotulo}</span>
      <input className={cn(classeCampo, className)} {...props} />
    </label>
  );
}
