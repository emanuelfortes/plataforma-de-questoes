import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { RegistrarSW } from "@/components/registrar-sw";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: { default: "Riccardo Nobrega", template: "%s · Riccardo Nobrega" },
  description: "Resolva questões, revise com flashcards e acompanhe seu desempenho.",
  applicationName: "Riccardo Nobrega",
  // O manifesto vem de src/app/manifest.ts (Next liga sozinho). Abaixo, o que o iPhone lê à parte.
  appleWebApp: { capable: true, title: "R. Nobrega", statusBarStyle: "black" },
  icons: {
    icon: [{ url: "/icones/favicon-48.png", sizes: "48x48", type: "image/png" }],
    apple: [{ url: "/icones/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

// Cor da barra do navegador e do app instalado (= --color-fundo).
export const viewport: Viewport = {
  themeColor: "#081433",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body className="min-h-dvh">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
