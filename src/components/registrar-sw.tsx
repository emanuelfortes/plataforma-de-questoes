"use client";

import { useEffect } from "react";

/** Registra o service worker (public/sw.js) para o app poder ser instalado e ter a tela "sem internet". */
export function RegistrarSW() {
  useEffect(() => {
    // Em desenvolvimento o service worker atrapalha o recarregamento automático do Next.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((erro) => console.error("[sw]", erro));
  }, []);
  return null;
}
