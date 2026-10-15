// Traduz os erros do Better Auth para mensagens em português.
const MENSAGENS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  INVALID_PASSWORD: "Senha incorreta.",
  INVALID_EMAIL: "E-mail inválido.",
  PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
  PASSWORD_TOO_LONG: "A senha pode ter no máximo 128 caracteres.",
  USER_ALREADY_EXISTS: "Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.",
  INVALID_TOKEN: "Este link é inválido ou já expirou. Peça um novo.",
  TOKEN_EXPIRED: "Este link expirou. Peça um novo.",
  EMAIL_ALREADY_VERIFIED: "Seu e-mail já está confirmado.",
  SESSION_EXPIRED: "Por segurança, entre de novo antes de fazer isso.",
  SESSION_NOT_FRESH: "Por segurança, entre de novo antes de fazer isso.",
  INVALID_ORIGIN: "Acesso bloqueado por segurança. Abra o site pelo endereço oficial.",
  MISSING_OR_NULL_ORIGIN: "Acesso bloqueado por segurança. Abra o site pelo endereço oficial.",
  USER_NOT_FOUND: "Conta não encontrada.",
};

type ErroAuth = { code?: string; status?: number; message?: string } | null | undefined;

export function traduzirErroAuth(erro: ErroAuth, padrao = "Algo deu errado. Tente de novo.") {
  if (!erro) return padrao;
  if (erro.status === 429) return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  return (erro.code && MENSAGENS[erro.code]) || padrao;
}
