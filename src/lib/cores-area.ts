// Cor de cada parte da plataforma (tokens em src/app/globals.css). Classes escritas por inteiro para o Tailwind achar.
// Usado nos cartões de entrada (/estudar) e na aba ativa da navegação.

export type CorArea = {
  /** Ícone e textos de destaque. */
  texto: string;
  /** Fundo suave (selo do ícone, aba ativa). */
  fundo: string;
  /** Faixa cheia (borda de cima do cartão). */
  barra: string;
  /** Cor da borda (sublinhado da aba ativa). */
  linha: string;
  /** Borda no hover e no foco. */
  borda: string;
};

export const COR_AREA = {
  questoes: { texto: "text-questoes", fundo: "bg-questoes-suave", barra: "bg-questoes", linha: "border-questoes", borda: "hover:border-questoes focus-visible:border-questoes" },
  flashcards: { texto: "text-flash", fundo: "bg-flash-suave", barra: "bg-flash", linha: "border-flash", borda: "hover:border-flash focus-visible:border-flash" },
  simulados: { texto: "text-simulado", fundo: "bg-simulado-suave", barra: "bg-simulado", linha: "border-simulado", borda: "hover:border-simulado focus-visible:border-simulado" },
  vade: { texto: "text-vade", fundo: "bg-vade-suave", barra: "bg-vade", linha: "border-vade", borda: "hover:border-vade focus-visible:border-vade" },
  desempenho: { texto: "text-acerto", fundo: "bg-acerto-suave", barra: "bg-acerto", linha: "border-acerto", borda: "hover:border-acerto focus-visible:border-acerto" },
  ranking: { texto: "text-ouro", fundo: "bg-destaque-suave", barra: "bg-ouro", linha: "border-ouro", borda: "hover:border-ouro focus-visible:border-ouro" },
  marca: { texto: "text-marca-clara", fundo: "bg-marca-suave", barra: "bg-marca", linha: "border-marca", borda: "hover:border-marca focus-visible:border-marca" },
} satisfies Record<string, CorArea>;

export type ChaveCor = keyof typeof COR_AREA;
