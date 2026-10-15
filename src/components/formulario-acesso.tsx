"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CampoSenha, classeCampo } from "@/components/campo-senha";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { traduzirErroAuth } from "@/lib/erros-auth";

/** Moldura comum das telas públicas. */
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
      <div className="w-full max-w-[380px] space-y-6">
        <div className="flex items-center gap-2.5 font-extrabold">
          <span className="grid size-8 place-items-center rounded-lg bg-marca text-sm text-white">RN</span>
          <span>Riccardo Nobrega</span>
        </div>
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">{subtitulo}</p>
          <h1 className="mt-1 text-4xl font-extrabold leading-[1.1] tracking-[-.03em]">{titulo}</h1>
        </div>
        {children}
        {rodape && <p className="text-sm text-suave">{rodape}</p>}
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
          : await authClient.signUp.email({ email, password: senha, name: nome, callbackURL: "/conta" });
      if (error) {
        setErro(traduzirErroAuth(error, modo === "entrar" ? "E-mail ou senha incorretos." : "Não foi possível criar a conta."));
        return;
      }
      router.push("/estudar");
      router.refresh();
    });
  }

  const rotulo = "text-[13px] font-bold text-texto/75";

  return (
    <CaixaAcesso
      titulo={modo === "entrar" ? "Entre e continue de onde parou." : "Comece hoje. Amanhã é o dia 2."}
      subtitulo={modo === "entrar" ? "Bem-vindo de volta" : "Criar conta"}
      rodape={
        modo === "entrar" ? (
          <>Não tem conta? <Link href="/cadastrar" className="font-extrabold text-destaque hover:underline">Cadastre-se</Link></>
        ) : (
          <>Já tem conta? <Link href="/entrar" className="font-extrabold text-destaque hover:underline">Entrar</Link></>
        )
      }
    >
      {aviso && <p className="rounded-lg bg-acerto-suave px-3 py-2 text-sm text-acerto">{aviso}</p>}
      <form action={enviar} className="space-y-4">
        {modo === "cadastrar" && (
          <label className="block space-y-1.5">
            <span className={rotulo}>Nome</span>
            <input name="nome" required maxLength={80} autoComplete="name" className={classeCampo} />
          </label>
        )}
        <label className="block space-y-1.5">
          <span className={rotulo}>E-mail</span>
          <input name="email" type="email" required autoComplete="email" className={classeCampo} />
        </label>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="senha" className={rotulo}>Senha</label>
            {modo === "entrar" && (
              <Link href="/esqueci-senha" className="text-xs font-bold text-marca-clara hover:underline">Esqueci minha senha</Link>
            )}
          </div>
          <CampoSenha id="senha" name="senha" required autoComplete={modo === "entrar" ? "current-password" : "new-password"} />
          {modo === "cadastrar" && <p className="text-xs text-suave">Mínimo de 8 caracteres.</p>}
        </div>
        {erro && <p className="text-sm text-erro">{erro}</p>}
        <Button type="submit" tamanho="grande" className="w-full shadow-[0_8px_24px_rgba(47,107,255,.4)]" disabled={enviando}>
          {enviando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
    </CaixaAcesso>
  );
}
