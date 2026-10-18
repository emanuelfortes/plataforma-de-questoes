import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { account, rateLimit, session, user, verification } from "@/db/schema";
import { cancelarAssinaturasDoUsuario } from "@/server/assinatura";
import { apagarDadosDeEstudo } from "@/server/conta";
import { emailConfirmarEndereco, emailRedefinirSenha, enviarEmail } from "@/server/email";

// Endereços que a Vercel gera para o mesmo projeto (domínio de produção, deploy e branch).
// Sem eles, abrir o site por um endereço diferente de BETTER_AUTH_URL dá "Invalid origin".
const origensVercel = [
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_URL,
  process.env.VERCEL_BRANCH_URL,
]
  .filter((host): host is string => Boolean(host))
  .map((host) => `https://${host}`);

const UMA_HORA = 60 * 60;

export const auth = betterAuth({
  trustedOrigins: origensVercel,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { user, session, account, verification, rateLimit },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: UMA_HORA,
    // Quem redefine a senha derruba as sessões abertas (ex.: num computador emprestado).
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await enviarEmail({ para: user.email, ...emailRedefinirSenha(user.name, url) });
    },
  },
  // Confirmação não bloqueia o acesso: o aluno entra direto e vê um aviso até confirmar.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 24 * UMA_HORA,
    sendVerificationEmail: async ({ user, url }) => {
      await enviarEmail({ para: user.email, ...emailConfirmarEndereco(user.name, url) });
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (usuario) => {
        // Sem isso o Mercado Pago continuaria cobrando quem excluiu a conta.
        try {
          await cancelarAssinaturasDoUsuario(usuario.id);
        } catch (erro) {
          console.error("[conta] falha ao cancelar assinatura antes de excluir:", erro);
          throw new APIError("BAD_REQUEST", {
            message: "Não foi possível cancelar sua assinatura agora. Tente de novo ou fale conosco pelo WhatsApp.",
          });
        }
        await apagarDadosDeEstudo(usuario.id);
      },
    },
  },
  // Só vale em produção. Janela em segundos.
  rateLimit: {
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
      "/change-password": { window: 60, max: 5 },
      "/delete-user": { window: 60, max: 3 },
    },
  },
  // Login social (Google etc.) entra aqui. Veja PLANO.md, fase 6.
  // socialProviders: { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } },
  plugins: [nextCookies()],
});

export type Sessao = typeof auth.$Infer.Session;
