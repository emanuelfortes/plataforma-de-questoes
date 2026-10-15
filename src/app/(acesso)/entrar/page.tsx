import type { Metadata } from "next";
import { FormularioAcesso } from "@/components/formulario-acesso";

export const metadata: Metadata = { title: "Entrar" };

const AVISOS: Record<string, string> = {
  "senha-redefinida": "Senha alterada. Entre com a nova senha.",
  "conta-excluida": "Sua conta foi excluída.",
};

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;
  return <FormularioAcesso modo="entrar" aviso={aviso ? AVISOS[aviso] : undefined} />;
}
