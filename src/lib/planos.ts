// Plano de assinatura e limite de quem não assina. Compartilhado entre servidor e cliente.

export const ASSINATURA = {
  nome: "Plano Basic",
  /** Valor cobrado todo mês, em reais. */
  valor: 24.9,
  /** Aparece no checkout, no painel do Mercado Pago e na fatura do aluno. */
  descricao: "Riccardo Nóbrega - Assinatura mensal",
} as const;

/** Elite: o Basic mais os simulados do mês (PDF para imprimir, gabarito com cronômetro e ranking). */
export const ELITE = {
  nome: "Plano Elite",
  valor: 34.9,
  descricao: "Riccardo Nóbrega - Plano Elite",
} as const;

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
 * Black Friday: paga uma vez (Pix ou cartão) e ganha 2 meses. Não renova sozinha: perto do fim, o aluno
 * ativa a assinatura mensal, que só começa a cobrar quando os 2 meses acabam. Uma por conta.
 */
export const BLACK_FRIDAY = {
  nome: "Black Friday: 2 meses",
  valor: 39.8,
  dias: 60,
  descricao: "Riccardo Nóbrega - Black Friday 2 meses",
  /** Último dia da oferta (fuso de Brasília). Depois disso o botão some sozinho. */
  ate: "2026-12-31",
} as const;

export function blackFridayAberta(agora = new Date()) {
  return agora.getTime() < new Date(`${BLACK_FRIDAY.ate}T23:59:59-03:00`).getTime();
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
/** Compras de pagamento único (Black Friday): "nobrega-questoes:compra:<usuarioId>". */
export const PREFIXO_COMPRA = `${PREFIXO_REFERENCIA}:compra`;

export function formatarReais(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
