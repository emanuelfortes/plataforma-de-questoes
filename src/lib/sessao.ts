import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function obterSessao() {
  return auth.api.getSession({ headers: await headers() });
}

/** Use em toda página e server action que dependa do aluno. Redireciona para /entrar se não houver sessão. */
export async function exigirUsuario() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar");
  return sessao.user;
}
