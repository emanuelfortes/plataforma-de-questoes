"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const classeCampo =
  "h-10 w-full rounded-lg border border-borda bg-superficie px-3 text-sm focus-visible:outline-2 focus-visible:outline-marca";

export function FormularioAcesso({ modo }: { modo: "entrar" | "cadastrar" }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function enviar(dados: FormData) {
    setErro(null);
    const email = String(dados.get("email") ?? "");
    const senha = String(dados.get("senha") ?? "");
    const nome = String(dados.get("nome") ?? "");

    iniciar(async () => {
      const { error } =
        modo === "entrar"
          ? await authClient.signIn.email({ email, password: senha })
          : await authClient.signUp.email({ email, password: senha, name: nome });
      if (error) {
        setErro(
          modo === "entrar"
            ? "E-mail ou senha incorretos."
            : (error.message ?? "Não foi possível criar a conta."),
        );
        return;
      }
      router.push("/questoes");
      router.refresh();
    });
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-borda bg-superficie p-6 shadow-xs">
        <h1 className="text-xl font-semibold tracking-tight">
          {modo === "entrar" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="mt-1 text-sm text-suave">
          {modo === "entrar"
            ? "Continue de onde parou."
            : "Comece a resolver questões e acompanhar seu desempenho."}
        </p>

        <form action={enviar} className="mt-6 space-y-4">
          {modo === "cadastrar" && (
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Nome</span>
              <input name="nome" required autoComplete="name" className={classeCampo} />
            </label>
          )}
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">E-mail</span>
            <input name="email" type="email" required autoComplete="email" className={classeCampo} />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Senha</span>
            <input
              name="senha"
              type="password"
              required
              minLength={8}
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              className={classeCampo}
            />
          </label>
          {erro && <p className="text-sm text-erro">{erro}</p>}
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-suave">
          {modo === "entrar" ? (
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
          )}
        </p>
      </div>
    </main>
  );
}
