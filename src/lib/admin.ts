// Quem é dono (ADMIN_EMAILS). Separado de sessao.ts para não criar dependência circular com auth.ts.

/** E-mails com acesso à área do dono (/admin), separados por vírgula em ADMIN_EMAILS. */
export function ehAdmin(email: string) {
  const lista = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
  return lista.includes(email.trim().toLowerCase());
}
