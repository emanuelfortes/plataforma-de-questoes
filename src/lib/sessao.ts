import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
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

/** E-mails com acesso à área do dono (/admin), separados por vírgula em ADMIN_EMAILS. */
export function ehAdmin(email: string) {
  const lista = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
  return lista.includes(email.trim().toLowerCase());
}

/** Como exigirUsuario, mas só para o dono. Para os outros a página "não existe" (404). */
export async function exigirAdmin() {
  const usuario = await exigirUsuario();
  if (!ehAdmin(usuario.email)) notFound();
  return usuario;
}
