"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Mostrada quando uma página quebra no servidor ou no navegador.
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[60dvh] place-items-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Algo deu errado</h1>
        <p className="mt-2 text-sm text-suave">
          Não conseguimos carregar esta página. Tente de novo em alguns segundos.
        </p>
        {error.digest && <p className="mt-2 text-xs text-suave">Código do erro: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>Tentar de novo</Button>
          <a href="/" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium hover:bg-borda/50">
            Ir para o início
          </a>
        </div>
      </div>
    </main>
  );
}
