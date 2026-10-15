import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao";

export default async function Inicio() {
  const sessao = await obterSessao();
  redirect(sessao ? "/estudar" : "/entrar");
}
