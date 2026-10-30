import type { NextConfig } from "next";

// Só em desenvolvimento: abrir pelo celular na rede local (ex.: 192.168.0.10). Sem isso o Next bloqueia
// o JavaScript da página e nenhum botão funciona. Usa os mesmos endereços de BETTER_AUTH_TRUSTED_ORIGINS.
const origensDev = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean)
  .map((origem) => new URL(origem).hostname);

const nextConfig: NextConfig = {
  allowedDevOrigins: origensDev,
  // O cliente do libSQL tem binários nativos (modo arquivo local). Mantê-lo fora do bundle evita erros de build.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // O Vade Mecum lê o texto das leis do disco (data/leis): sem isto, a Vercel não leva os arquivos para o servidor.
  outputFileTracingIncludes: {
    "/vade-mecum": ["./data/leis/*.txt"],
    "/vade-mecum/[lei]": ["./data/leis/*.txt"],
  },
  // A tela do dono envia o arquivo de questões gerado pela IA (padrão do Next: 1 MB).
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  async headers() {
    return [
      {
        // O service worker nunca pode ficar em cache: senão uma versão nova não chega aos aparelhos.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
