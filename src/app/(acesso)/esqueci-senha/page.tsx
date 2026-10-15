import type { Metadata } from "next";
import { FormularioEsqueciSenha } from "@/components/formularios-senha";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function PaginaEsqueciSenha() {
  return <FormularioEsqueciSenha />;
}
