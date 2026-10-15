import type { Metadata } from "next";
import { FormularioRedefinirSenha } from "@/components/formularios-senha";

export const metadata: Metadata = { title: "Criar nova senha" };

// O link do e-mail passa pelo Better Auth, que redireciona para cá com ?token=
// (ou com ?error=INVALID_TOKEN se o link expirou).
export default async function PaginaRedefinirSenha({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  return <FormularioRedefinirSenha token={!error && token ? token : null} />;
}
