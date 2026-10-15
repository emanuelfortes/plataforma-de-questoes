import Link from "next/link";
import { variantesBotao } from "@/components/ui/button";

export default function NaoEncontrada() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center">
        <p className="text-sm font-medium text-marca">Erro 404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Página não encontrada</h1>
        <p className="mt-2 text-sm text-suave">O endereço pode estar errado ou a página foi removida.</p>
        <Link href="/" className={variantesBotao({ className: "mt-6" })}>
          Voltar para o início
        </Link>
      </div>
    </main>
  );
}
