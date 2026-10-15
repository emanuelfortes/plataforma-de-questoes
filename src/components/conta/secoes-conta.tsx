"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CampoSenha, classeCampo } from "@/components/campo-senha";
import { Button } from "@/components/ui/button";
import { Card, CardTitulo } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { traduzirErroAuth } from "@/lib/erros-auth";

type Mensagem = { tipo: "ok" | "erro"; texto: string } | null;

function Retorno({ mensagem }: { mensagem: Mensagem }) {
  if (!mensagem) return null;
  return (
    <p className={mensagem.tipo === "ok" ? "text-sm text-acerto" : "text-sm text-erro"}>{mensagem.texto}</p>
  );
}

export function FormularioNome({ nome }: { nome: string }) {
  const router = useRouter();
  const [mensagem, setMensagem] = useState<Mensagem>(null);
  const [enviando, iniciar] = useTransition();

  function enviar(dados: FormData) {
    setMensagem(null);
    const novo = String(dados.get("nome") ?? "").trim();
    if (!novo) return setMensagem({ tipo: "erro", texto: "Informe seu nome." });
    iniciar(async () => {
      const { error } = await authClient.updateUser({ name: novo });
      if (error) return setMensagem({ tipo: "erro", texto: traduzirErroAuth(error) });
      setMensagem({ tipo: "ok", texto: "Nome atualizado." });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardTitulo>Seu nome</CardTitulo>
      <form action={enviar} className="mt-4 space-y-3">
        <input
          name="nome"
          defaultValue={nome}
          required
          maxLength={80}
          autoComplete="name"
          aria-label="Nome"
          className={classeCampo}
        />
        <Retorno mensagem={mensagem} />
        <Button type="submit" variante="contorno" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar nome"}
        </Button>
      </form>
    </Card>
  );
}

export function FormularioTrocarSenha() {
  const [mensagem, setMensagem] = useState<Mensagem>(null);
  const [enviando, iniciar] = useTransition();

  function enviar(dados: FormData) {
    setMensagem(null);
    const atual = String(dados.get("atual") ?? "");
    const nova = String(dados.get("nova") ?? "");
    if (nova !== String(dados.get("confirmacao") ?? "")) {
      return setMensagem({ tipo: "erro", texto: "As senhas novas não são iguais." });
    }
    iniciar(async () => {
      const { error } = await authClient.changePassword({
        currentPassword: atual,
        newPassword: nova,
        revokeOtherSessions: true,
      });
      if (error) {
        return setMensagem({
          tipo: "erro",
          texto: error.code === "INVALID_PASSWORD" ? "A senha atual está incorreta." : traduzirErroAuth(error),
        });
      }
      setMensagem({ tipo: "ok", texto: "Senha alterada. Os outros aparelhos foram desconectados." });
    });
  }

  return (
    <Card>
      <CardTitulo>Trocar senha</CardTitulo>
      <form action={enviar} className="mt-4 space-y-3 text-sm">
        <label className="block space-y-1.5">
          <span className="font-medium">Senha atual</span>
          <CampoSenha name="atual" required minLength={1} autoComplete="current-password" />
        </label>
        <label className="block space-y-1.5">
          <span className="font-medium">Nova senha</span>
          <CampoSenha name="nova" required autoComplete="new-password" />
          <span className="block text-xs text-suave">Mínimo de 8 caracteres.</span>
        </label>
        <label className="block space-y-1.5">
          <span className="font-medium">Repita a nova senha</span>
          <CampoSenha name="confirmacao" required autoComplete="new-password" />
        </label>
        <Retorno mensagem={mensagem} />
        <Button type="submit" variante="contorno" disabled={enviando}>
          {enviando ? "Salvando..." : "Trocar senha"}
        </Button>
      </form>
    </Card>
  );
}

export function SairDosOutrosAparelhos() {
  const [mensagem, setMensagem] = useState<Mensagem>(null);
  const [enviando, iniciar] = useTransition();

  function sair() {
    setMensagem(null);
    iniciar(async () => {
      const { error } = await authClient.revokeOtherSessions();
      setMensagem(
        error
          ? { tipo: "erro", texto: traduzirErroAuth(error) }
          : { tipo: "ok", texto: "Pronto. Só este aparelho continua conectado." },
      );
    });
  }

  return (
    <Card>
      <CardTitulo>Aparelhos conectados</CardTitulo>
      <p className="mt-1 text-sm text-suave">
        Entrou num computador emprestado e esqueceu de sair? Desconecte todos os outros aparelhos.
      </p>
      <div className="mt-4 space-y-3">
        <Retorno mensagem={mensagem} />
        <Button variante="contorno" onClick={sair} disabled={enviando}>
          {enviando ? "Desconectando..." : "Sair de todos os outros aparelhos"}
        </Button>
      </div>
    </Card>
  );
}

export function MeusDados() {
  return (
    <Card>
      <CardTitulo>Seus dados</CardTitulo>
      <p className="mt-1 text-sm text-suave">
        Baixe uma cópia de tudo que guardamos sobre você: perfil, respostas e revisões de flashcards.
      </p>
      {/* Link comum (não Link do Next): a rota devolve um arquivo para download. */}
      <a
        href="/api/meus-dados"
        className="mt-4 inline-flex h-10 items-center rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:bg-fundo"
      >
        Baixar meus dados
      </a>
    </Card>
  );
}

const CONFIRMACAO = "EXCLUIR";

export function ExcluirConta() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState<Mensagem>(null);
  const [enviando, iniciar] = useTransition();

  function enviar(dados: FormData) {
    setMensagem(null);
    if (String(dados.get("confirmacao") ?? "").trim().toUpperCase() !== CONFIRMACAO) {
      return setMensagem({ tipo: "erro", texto: `Digite ${CONFIRMACAO} para confirmar.` });
    }
    iniciar(async () => {
      const { error } = await authClient.deleteUser({ password: String(dados.get("senha") ?? "") });
      if (error) {
        return setMensagem({
          tipo: "erro",
          texto: error.code === "INVALID_PASSWORD" ? "Senha incorreta." : traduzirErroAuth(error),
        });
      }
      router.push("/entrar?aviso=conta-excluida");
      router.refresh();
    });
  }

  return (
    <Card className="border-erro/30">
      <CardTitulo className="text-erro">Excluir conta</CardTitulo>
      <p className="mt-1 text-sm text-suave">
        Apaga sua conta e todo o seu histórico de estudo (respostas, desempenho e flashcards). Não dá
        para desfazer.
      </p>
      {!aberto ? (
        <Button variante="contorno" className="mt-4 text-erro" onClick={() => setAberto(true)}>
          Quero excluir minha conta
        </Button>
      ) : (
        <form action={enviar} className="mt-4 space-y-3 text-sm">
          <label className="block space-y-1.5">
            <span className="font-medium">Sua senha</span>
            <CampoSenha name="senha" required minLength={1} autoComplete="current-password" />
          </label>
          <label className="block space-y-1.5">
            <span className="font-medium">
              Digite <strong>{CONFIRMACAO}</strong> para confirmar
            </span>
            <input name="confirmacao" required autoComplete="off" className={classeCampo} />
          </label>
          <Retorno mensagem={mensagem} />
          <div className="flex gap-2">
            <Button type="submit" className="bg-erro hover:bg-erro" disabled={enviando}>
              {enviando ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
            <Button type="button" variante="fantasma" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
