// Plano de assinatura e limite de quem não assina. Compartilhado entre servidor e cliente.

export const ASSINATURA = {
  nome: "Assinatura mensal",
  /** Valor cobrado todo mês, em reais. */
  valor: 24.9,
  /** Aparece no checkout, no painel do Mercado Pago e na fatura do aluno. */
  descricao: "Riccardo Nóbrega - Assinatura mensal",
} as const;

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

export function formatarReais(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
