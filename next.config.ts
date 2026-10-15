import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O cliente do libSQL tem binários nativos (modo arquivo local). Mantê-lo fora do bundle evita erros de build.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
