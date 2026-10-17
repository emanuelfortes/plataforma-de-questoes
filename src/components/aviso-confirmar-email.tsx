"use client";

import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { traduzirErroAuth } from "@/lib/erros-auth";

/** Faixa no topo enquanto o aluno não confirma o e-mail. Não bloqueia o uso. */
export function AvisoConfirmarEmail({ email }: { email: string }) {
  const [retorno, setRetorno] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function reenviar() {
    iniciar(async () => {
      const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/conta" });
      setRetorno(error ? traduzirErroAuth(error) : "E-mail enviado. Confira também a caixa de spam.");
    });
  }

  return (
    <div className="border-b border-borda bg-marca-suave">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm text-marca-clara">
        <span>
          Confirme seu e-mail (<strong className="font-medium break-all">{email}</strong>) para poder recuperar a
          senha se precisar.
        </span>
        {retorno ? (
          <span className="font-medium">{retorno}</span>
        ) : (
          <button onClick={reenviar} disabled={enviando} className="font-medium underline disabled:opacity-50">
            {enviando ? "Enviando..." : "Reenviar e-mail"}
          </button>
        )}
      </div>
    </div>
  );
}
