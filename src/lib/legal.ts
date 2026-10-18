// Dados usados nos Termos de uso e na Política de privacidade (/termos e /privacidade).
// Mudou algo relevante nos textos? Atualize atualizadoEm.

export const LEGAL = {
  /** Quem responde pela plataforma (pessoa ou empresa). Na LGPD, o "controlador" dos dados. */
  responsavel: "Riccardo Nóbrega",
  /** CPF ou CNPJ (opcional; deixe vazio para não exibir). */
  documento: "",
  /**
   * WhatsApp de atendimento (dúvidas, erros em questões e pedidos sobre dados pessoais).
   * Só números, com 55 + DDD: ex. "5585999999999".
   */
  whatsapp: "558591053277",
  site: "riccardonobrega.com",
  /** Cidade e estado do foro para disputas. */
  foro: "",
  atualizadoEm: "18 de outubro de 2026",
} as const;

/** "(85) 99999-9999" a partir de "5585999999999". */
export function whatsappFormatado() {
  const n = LEGAL.whatsapp.replace(/\D/g, "").replace(/^55/, "");
  return n.length >= 10 ? `(${n.slice(0, 2)}) ${n.slice(2, -4)}-${n.slice(-4)}` : n;
}

/** Link que abre a conversa no WhatsApp já com uma mensagem. */
export function linkWhatsapp(mensagem: string) {
  return `https://wa.me/${LEGAL.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(mensagem)}`;
}
