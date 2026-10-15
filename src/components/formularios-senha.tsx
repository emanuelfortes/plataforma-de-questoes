"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CampoSenha, classeCampo } from "@/components/campo-senha";
import { CaixaAcesso } from "@/components/formulario-acesso";
import { Button, variantesBotao } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { traduzirErroAuth } from "@/lib/erros-auth";
import { cn } from "@/lib/utils";

const voltarAoLogin = (
  <Link href="/entrar" className="font-medium text-marca hover:underline">
    Voltar para o login
  </Link>
);

export function FormularioEsqueciSenha() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, iniciar] = useTransition();

  function enviar(dados: FormData) {
    setErro(null);
    const email = String(dados.get("email") ?? "").trim();
    iniciar(async () => {
      const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/redefinir-senha" });
      if (error) {
        setErro(traduzirErroAuth(error));
        return;
      }
      setEnviado(true);
    });
  }

  if (enviado) {
    return (
      <CaixaAcesso titulo="Confira seu e-mail" subtitulo="Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha." rodape={voltarAoLogin}>
        <p className="text-sm text-suave">
          O link vale por 1 hora. Não chegou em alguns minutos? Olhe a caixa de spam ou tente de novo.
        </p>
        <Button variante="contorno" className="mt-4 w-full" onClick={() => setEnviado(false)}>
          Tentar de novo
        </Button>
      </CaixaAcesso>
    );
  }

  return (
    <CaixaAcesso titulo="Esqueci minha senha" subtitulo="Informe seu e-mail e enviaremos um link para criar uma nova senha." rodape={voltarAoLogin}>
      <form action={enviar} className="space-y-4">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">E-mail</span>
          <input name="email" type="email" required autoComplete="email" className={classeCampo} />
        </label>
        {erro && <p className="text-sm text-erro">{erro}</p>}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Enviando..." : "Enviar link"}
        </Button>
      </form>
    </CaixaAcesso>
  );
}

export function FormularioRedefinirSenha({ token }: { token: string | null }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  if (!token) {
    return (
      <CaixaAcesso titulo="Link inválido" subtitulo="Este link é inválido ou já expirou." rodape={voltarAoLogin}>
        <Link href="/esqueci-senha" className={cn(variantesBotao(), "w-full")}>
          Pedir um novo link
        </Link>
      </CaixaAcesso>
    );
  }

  function enviar(dados: FormData) {
    setErro(null);
    const senha = String(dados.get("senha") ?? "");
    if (senha !== String(dados.get("confirmacao") ?? "")) {
      setErro("As senhas não são iguais.");
      return;
    }
    iniciar(async () => {
      const { error } = await authClient.resetPassword({ newPassword: senha, token: token! });
      if (error) {
        setErro(traduzirErroAuth(error));
        return;
      }
      router.push("/entrar?aviso=senha-redefinida");
    });
  }

  return (
    <CaixaAcesso titulo="Criar nova senha" subtitulo="Por segurança, você vai sair de todos os aparelhos conectados." rodape={voltarAoLogin}>
      <form action={enviar} className="space-y-4">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Nova senha</span>
          <CampoSenha name="senha" required autoComplete="new-password" />
          <span className="block text-xs text-suave">Mínimo de 8 caracteres.</span>
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Repita a nova senha</span>
          <CampoSenha name="confirmacao" required autoComplete="new-password" />
        </label>
        {erro && <p className="text-sm text-erro">{erro}</p>}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </CaixaAcesso>
  );
}
