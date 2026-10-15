"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CampoSenha, classeCampo } from "@/components/campo-senha";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { traduzirErroAuth } from "@/lib/erros-auth";

/** Moldura comum das telas públicas (entrar, cadastrar, recuperar senha). */
export function CaixaAcesso({
  titulo,
  subtitulo,
  children,
  rodape,
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-borda bg-superficie p-6 shadow-xs">
        <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
        <p className="mt-1 text-sm text-suave">{subtitulo}</p>
        <div className="mt-6">{children}</div>
        {rodape && <p className="mt-6 text-center text-sm text-suave">{rodape}</p>}
      </div>
    </main>
  );
}

export function FormularioAcesso({ modo, aviso }: { modo: "entrar" | "cadastrar"; aviso?: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function enviar(dados: FormData) {
    setErro(null);
    const email = String(dados.get("email") ?? "").trim();
    const senha = String(dados.get("senha") ?? "");
    const nome = String(dados.get("nome") ?? "").trim();

    iniciar(async () => {
      const { error } =
        modo === "entrar"
          ? await authClient.signIn.email({ email, password: senha })
          : await authClient.signUp.email({
              email,
              password: senha,
              name: nome,
              // Para onde o link de confirmação do e-mail leva.
              callbackURL: "/conta",
            });
      if (error) {
        setErro(
          traduzirErroAuth(
            error,
            modo === "entrar" ? "E-mail ou senha incorretos." : "Não foi possível criar a conta.",
          ),
        );
        return;
      }
      router.push("/questoes");
      router.refresh();
    });
  }

  return (
    <CaixaAcesso
      titulo={modo === "entrar" ? "Entrar" : "Criar conta"}
      subtitulo={
        modo === "entrar"
          ? "Continue de onde parou."
          : "Comece a resolver questões e acompanhar seu desempenho."
      }
      rodape={
        modo === "entrar" ? (
          <>
            Não tem conta?{" "}
            <Link href="/cadastrar" className="font-medium text-marca hover:underline">
              Cadastre-se
            </Link>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <Link href="/entrar" className="font-medium text-marca hover:underline">
              Entrar
            </Link>
          </>
        )
      }
    >
      {aviso && (
        <p className="mb-4 rounded-lg bg-acerto-suave px-3 py-2 text-sm text-acerto">{aviso}</p>
      )}
      <form action={enviar} className="space-y-4">
        {modo === "cadastrar" && (
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Nome</span>
            <input name="nome" required maxLength={80} autoComplete="name" className={classeCampo} />
          </label>
        )}
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">E-mail</span>
          <input name="email" type="email" required autoComplete="email" className={classeCampo} />
        </label>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-baseline justify-between">
            <label htmlFor="senha" className="font-medium">
              Senha
            </label>
            {modo === "entrar" && (
              <Link href="/esqueci-senha" className="text-xs text-marca hover:underline">
                Esqueci minha senha
              </Link>
            )}
          </div>
          <CampoSenha
            id="senha"
            name="senha"
            required
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
          />
          {modo === "cadastrar" && <p className="text-xs text-suave">Mínimo de 8 caracteres.</p>}
        </div>
        {erro && <p className="text-sm text-erro">{erro}</p>}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
    </CaixaAcesso>
  );
}
