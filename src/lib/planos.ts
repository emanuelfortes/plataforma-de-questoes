// Plano de assinatura e limite de quem não assina. Compartilhado entre servidor e cliente.

export const ASSINATURA = {
  nome: "Plano Basic",
  /** Valor cobrado todo mês, em reais. */
  valor: 29.9,
  /** Aparece no checkout, no painel do Mercado Pago e na fatura do aluno. */
  descricao: "Riccardo Nóbrega QProva - Assinatura mensal",
} as const;

/** Tropa de Elite: os simulados do mês, vendidos como adicional do Basic. O aluno paga a soma numa cobrança só. */
export const ADICIONAL_ELITE = 9.9;

/** Elite: o Basic mais os simulados do mês (PDF para imprimir, gabarito com cronômetro e ranking). */
export const ELITE = {
  nome: "Tropa de Elite",
  valor: somar(ASSINATURA.valor, ADICIONAL_ELITE),
  descricao: "Riccardo Nóbrega QProva - Tropa de Elite",
} as const;

/**
 * Novas assinaturas no cartão. Desligado em 06/11/2026 (recusas do antifraude, ver docs/ESTADO-ATUAL.md): só o Pix
 * aparece e o servidor recusa cartão novo. Quem já assina no cartão segue igual. Para voltar, troque para true.
 */
export const CARTAO_LIGADO = true;

export type Plano = "basico" | "elite";
export const PLANOS = { basico: ASSINATURA, elite: ELITE } as const;

/** Concursos que têm simulado no Elite. */
export const CONCURSOS_SIMULADO = ["GM Fortaleza", "GM Itaitinga", "CFO PMCE"] as const;

export const BENEFICIOS_ELITE = [
  "Tudo do plano Basic",
  "2 simulados por mês: GM Fortaleza, GM Itaitinga e CFO PMCE",
  "PDF para imprimir e fazer como no dia da prova",
  "Gabarito com cronômetro e ranking dos simulados",
];

/**
 * Black Friday: quem assina até o fim de novembro paga para sempre o preço promocional (o valor fica gravado
 * na assinatura do Mercado Pago). Depois, quem assina (ou cancela e volta) paga o valor cheio. O adicional
 * da Tropa de Elite não muda na promoção.
 */
export const PROMOCAO = {
  nome: "Promoção Black Friday 💀",
  /** Último dia (fuso de Brasília). */
  ate: "2026-11-30",
  basico: 24.9,
  elite: somar(24.9, ADICIONAL_ELITE),
} as const;

export function promocaoAberta(agora = new Date()) {
  return agora.getTime() <= new Date(`${PROMOCAO.ate}T23:59:59-03:00`).getTime();
}

/** Preço de quem assina agora (promocional até o fim da promoção). Calcule no servidor e passe para a tela. */
export function precoDoPlano(plano: Plano, agora = new Date()) {
  return promocaoAberta(agora) ? PROMOCAO[plano] : PLANOS[plano].valor;
}

/**
 * A assinatura é Elite? O Mercado Pago só guarda o valor, então o plano sai dele: qualquer valor de Elite
 * (o promocional também) é maior que qualquer valor do Basic. Mantenha assim ao mudar preços.
 */
export function valorEhElite(centavos: number) {
  return centavos >= Math.round(Math.min(PROMOCAO.elite, ELITE.valor) * 100);
}

/**
 * Valor da assinatura depois de incluir ou tirar a Tropa de Elite: soma ou tira o adicional do que o aluno já
 * paga, para quem assinou na Black Friday não perder o preço do Basic. Em centavos.
 */
export function valorAoTrocar(centavosAtuais: number, plano: Plano) {
  const adicional = Math.round(ADICIONAL_ELITE * 100);
  const elite = valorEhElite(centavosAtuais);
  if (plano === "elite") return elite ? centavosAtuais : centavosAtuais + adicional;
  return elite ? centavosAtuais - adicional : centavosAtuais;
}

/** O que a assinatura inclui (página inicial e tela de assinatura). */
export const BENEFICIOS_ASSINATURA = [
  "Questões ilimitadas",
  "Cards inteligentes",
  "Desempenho (diário, semanal, mensal)",
  "Ranking de elite",
  "Todos os conteúdos",
  "Gabarito comentado",
];

/** Questões por dia (fuso de Brasília) para quem não assina. */
export const LIMITE_GRATIS_DIA = 5;

/**
 * Prefixo do external_reference no Mercado Pago ("nobrega-questoes:<usuarioId>").
 * Separa o dinheiro da plataforma do de outros produtos na mesma conta (ex.: LexCursos).
 */
export const PREFIXO_REFERENCIA = "nobrega-questoes";

/** Pix: cada pagamento vale estes dias (não renova sozinho). external_reference "nobrega-questoes-pix:<usuarioId>". */
export const DIAS_PIX = 30;
export const PREFIXO_PIX = `${PREFIXO_REFERENCIA}-pix`;

/** Soma em centavos, para 29,90 + 9,90 dar 39,80 e não 39,800000000000004. */
function somar(a: number, b: number) {
  return Math.round((a + b) * 100) / 100;
}

export function formatarReais(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
