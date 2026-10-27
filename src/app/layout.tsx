import type { Metadata, Viewport } from "next";
import { Black_Ops_One, Manrope } from "next/font/google";
import { cookies } from "next/headers";
import { RegistrarSW } from "@/components/registrar-sw";
import { COOKIE_TEMA, COR_BARRA, lerTema } from "@/lib/tema";
import "./globals.css";
import { NOME_CURTO, NOME_PLATAFORMA } from "@/lib/marca";

const manrope = Manrope({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-manrope" });
// Estêncil do ranking. Sem preload: só baixa nas páginas que usam font-estencil.
const estencil = Black_Ops_One({ subsets: ["latin"], weight: "400", variable: "--font-black-ops", preload: false });

export const metadata: Metadata = {
  title: { default: NOME_PLATAFORMA, template: `%s · ${NOME_PLATAFORMA}` },
  description: "Resolva questões, revise com flashcards e acompanhe seu desempenho.",
  applicationName: NOME_PLATAFORMA,
  // O manifesto vem de src/app/manifest.ts (Next liga sozinho). Abaixo, o que o iPhone lê à parte.
  appleWebApp: { capable: true, title: NOME_CURTO, statusBarStyle: "black" },
  icons: {
    icon: [{ url: "/icones/favicon-48.png", sizes: "48x48", type: "image/png" }],
    apple: [{ url: "/icones/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

// Cor da barra do navegador e do app instalado (= --color-fundo de cada visão).
// O botão de tema troca essa cor na hora quando o aluno escolhe uma visão.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: COR_BARRA.claro },
    { media: "(prefers-color-scheme: dark)", color: COR_BARRA.escuro },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  // Libera env(safe-area-inset-*) para a barra de abas não ficar sob a barra de gestos do iPhone.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Visão escolhida pelo aluno (cookie). Sem escolha, o CSS segue a preferência do aparelho.
  const tema = lerTema((await cookies()).get(COOKIE_TEMA)?.value);
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${estencil.variable}`} data-tema={tema}>
      <body className="min-h-dvh">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
