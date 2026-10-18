import type { Metadata } from "next";
import Link from "next/link";
import {
  ExcluirConta,
  FormularioNome,
  FormularioTrocarSenha,
  MeusDados,
  SairDosOutrosAparelhos,
} from "@/components/conta/secoes-conta";
import { Card, CardTitulo } from "@/components/ui/card";
import { exigirUsuario } from "@/lib/sessao";

export const metadata: Metadata = { title: "Minha conta" };

// O link de confirmação de e-mail volta para cá (com ?error=... se o link expirou).
export default async function PaginaConta({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const usuario = await exigirUsuario();
  const { error } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Minha conta</h1>
        <p className="mt-1 text-sm text-suave">Seus dados de acesso e privacidade.</p>
      </div>

      {error && !usuario.emailVerified && (
        <p className="rounded-lg bg-erro-suave px-3 py-2 text-sm text-erro">
          O link de confirmação é inválido ou expirou. Use o botão &quot;Reenviar e-mail&quot; no topo da
          página.
        </p>
      )}

      <Card>
        <CardTitulo>E-mail</CardTitulo>
        <p className="mt-2 text-sm">
          {usuario.email}{" "}
          {usuario.emailVerified ? (
            <span className="ml-1 rounded-md bg-acerto-suave px-2 py-0.5 text-xs font-medium text-acerto">
              Confirmado
            </span>
          ) : (
            <span className="ml-1 rounded-md bg-erro-suave px-2 py-0.5 text-xs font-medium text-erro">
              Não confirmado
            </span>
          )}
        </p>
      </Card>

      <FormularioNome nome={usuario.name} />
      <FormularioTrocarSenha />
      <SairDosOutrosAparelhos />
      <MeusDados />
      <ExcluirConta />

      <p className="text-center text-xs text-suave">
        <Link href="/termos" className="hover:text-texto">
          Termos de uso
        </Link>{" "}
        ·{" "}
        <Link href="/privacidade" className="hover:text-texto">
          Política de privacidade
        </Link>
      </p>
    </div>
  );
}
