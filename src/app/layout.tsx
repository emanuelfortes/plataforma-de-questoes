import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Plataforma de Questões", template: "%s · Plataforma de Questões" },
  description: "Resolva questões, revise com flashcards e acompanhe seu desempenho.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
