// Plano de assinatura e limite de quem não assina. Compartilhado entre servidor e cliente.

export const ASSINATURA = {
  nome: "Assinatura mensal",
  /** Valor cobrado todo mês, em reais. */
  valor: 25,
  /** Aparece no checkout, no painel do Mercado Pago e na fatura do aluno. */
  descricao: "Nóbrega Questões - Assinatura mensal",
} as const;

/** Questões por dia (fuso de Brasília) para quem não assina. */
export const LIMITE_GRATIS_DIA = 10;

/**
 * Prefixo do external_reference no Mercado Pago ("nobrega-questoes:<usuarioId>").
 * Separa o dinheiro da plataforma do de outros produtos na mesma conta (ex.: LexCursos).
 */
export const PREFIXO_REFERENCIA = "nobrega-questoes";

export function formatarReais(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
