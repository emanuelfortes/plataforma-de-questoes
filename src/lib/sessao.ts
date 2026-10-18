import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ehAdmin } from "./admin";
import { auth } from "./auth";

export { ehAdmin };

export async function obterSessao() {
  return auth.api.getSession({ headers: await headers() });
}

/** Use em toda página e server action que dependa do aluno. Redireciona para /entrar se não houver sessão. */
export async function exigirUsuario() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar");
  return sessao.user;
}


/** Como exigirUsuario, mas só para o dono. Para os outros a página "não existe" (404). */
export async function exigirAdmin() {
  const usuario = await exigirUsuario();
  if (!ehAdmin(usuario.email)) notFound();
  return usuario;
}
