import type { Metadata } from "next";
import { FormularioAcesso } from "@/components/formulario-acesso";

export const metadata: Metadata = { title: "Criar conta" };

export default function PaginaCadastrar() {
  return <FormularioAcesso modo="cadastrar" />;
}
