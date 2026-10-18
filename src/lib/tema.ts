// Visão clara ou escura. A escolha fica num cookie para o servidor já desenhar a página certa
// (sem piscar). Sem cookie, vale a preferência do aparelho (prefers-color-scheme no CSS).
export const COOKIE_TEMA = "tema";
export type Tema = "claro" | "escuro";

export function lerTema(valor: string | undefined): Tema | undefined {
  return valor === "claro" || valor === "escuro" ? valor : undefined;
}

/** Cor da barra do navegador e do app instalado em cada visão (= --color-fundo). */
export const COR_BARRA: Record<Tema, string> = { escuro: "#262626", claro: "#f3f5f8" };
