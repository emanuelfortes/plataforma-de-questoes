"use client";

import { useEffect } from "react";

/** Aviso do navegador (Chrome/Android) de que o app pode ser instalado. */
export type PedidoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export const EVENTO_INSTALAR = "pedido-instalar";

declare global {
  interface Window {
    pedidoInstalar?: PedidoInstalar;
  }
}

/** Registra o service worker (public/sw.js) para o app poder ser instalado e ter a tela "sem internet". */
export function RegistrarSW() {
  useEffect(() => {
    // O Android avisa uma vez só, logo ao abrir, que dá para instalar. Guardamos o aviso para o botão
    // "Instalar app" (src/components/instalar-app.tsx) usar depois, em qualquer tela.
    const guardar = (e: Event) => {
      e.preventDefault();
      window.pedidoInstalar = e as PedidoInstalar;
      window.dispatchEvent(new Event(EVENTO_INSTALAR));
    };
    window.addEventListener("beforeinstallprompt", guardar);
    return () => window.removeEventListener("beforeinstallprompt", guardar);
  }, []);
  useEffect(() => {
    // Em desenvolvimento o service worker atrapalha o recarregamento automático do Next.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((erro) => console.error("[sw]", erro));
  }, []);
  return null;
}
