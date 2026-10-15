import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O cliente do libSQL tem binários nativos (modo arquivo local). Mantê-lo fora do bundle evita erros de build.
  serverExternalPackages: ["@libsql/client", "libsql"],
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
