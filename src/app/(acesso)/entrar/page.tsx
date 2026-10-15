import type { Metadata } from "next";
import { FormularioAcesso } from "@/components/formulario-acesso";

export const metadata: Metadata = { title: "Entrar" };

export default function PaginaEntrar() {
  return <FormularioAcesso modo="entrar" />;
}
