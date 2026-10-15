import type { MetadataRoute } from "next";

// Manifesto do PWA: é o que permite "Instalar app" / "Adicionar à tela inicial".
// Ícones gerados por scripts/gerar-icones.ts. Cores = tokens de src/app/globals.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Riccardo Nobrega",
    short_name: "R. Nobrega",
    description: "Resolva questões, revise com flashcards e acompanhe seu desempenho.",
    lang: "pt-BR",
    start_url: "/estudar",
    scope: "/",
    display: "standalone",
    background_color: "#081433",
    theme_color: "#081433",
    categories: ["education"],
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Resolver questões", url: "/estudar?tipo=questoes", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
      { name: "Revisar flashcards", url: "/estudar?tipo=flashcards", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
      { name: "Desempenho", url: "/desempenho", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
    ],
  };
}
