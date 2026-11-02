"use client";

import { Download, EllipsisVertical, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EVENTO_INSTALAR } from "./registrar-sw";

// Convite para instalar o app (PWA) na tela inicial do celular. Some para quem já abre pelo app instalado
// e para quem fecha o aviso. No Android com Chrome, o botão instala direto; no iPhone (e onde o navegador
// não oferece o botão), mostra o passo a passo.

type Sistema = "android" | "iphone";
const CHAVE_FECHADO = "instalar-app-fechado";

function sistemaDoAparelho(): Sistema | null {
  const ua = navigator.userAgent;
  // iPad novo se apresenta como Mac, mas tem tela de toque.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iphone";
  if (/Android/.test(ua)) return "android";
  return null;
}

function jaInstalado() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function InstalarApp() {
  const [visivel, setVisivel] = useState(false);
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [podeInstalarDireto, setPodeInstalarDireto] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<Sistema>("android");

  useEffect(() => {
    let fechado = false;
    try {
      fechado = localStorage.getItem(CHAVE_FECHADO) === "1";
    } catch {}
    const s = sistemaDoAparelho();
    if (jaInstalado() || fechado) return;
    setSistema(s);
    setAba(s ?? "android");
    const atualizar = () => {
      setPodeInstalarDireto(!!window.pedidoInstalar);
      // No computador só aparece quando o navegador oferece a instalação.
      setVisivel(!!s || !!window.pedidoInstalar);
    };
    const instalado = () => setVisivel(false);
    atualizar();
    window.addEventListener(EVENTO_INSTALAR, atualizar);
    window.addEventListener("appinstalled", instalado);
    return () => {
      window.removeEventListener(EVENTO_INSTALAR, atualizar);
      window.removeEventListener("appinstalled", instalado);
    };
  }, []);

  if (!visivel) return null;

  async function instalar() {
    const pedido = window.pedidoInstalar;
    if (!pedido) return setAberto(true);
    await pedido.prompt();
    const { outcome } = await pedido.userChoice;
    window.pedidoInstalar = undefined; // o aviso vale uma vez
    if (outcome === "accepted") setVisivel(false);
    else setPodeInstalarDireto(false);
  }

  function fechar() {
    try {
      localStorage.setItem(CHAVE_FECHADO, "1");
    } catch {}
    setVisivel(false);
  }

  return (
    <section className="relative rounded-2xl border border-marca/40 bg-marca-suave p-5 sm:p-6">
      <button type="button" onClick={fechar} aria-label="Fechar aviso de instalar o app" className="absolute right-3 top-3 rounded-lg p-1.5 text-suave hover:text-texto">
        <X className="size-4" aria-hidden />
      </button>
      <div className="flex items-start gap-4 pr-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-marca text-sobre-marca">
          <Smartphone className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-extrabold">Instale o app no seu celular</p>
          <p className="mt-0.5 text-sm text-texto/80">
            Abre direto da tela inicial, em tela cheia, como um aplicativo. Não ocupa espaço e não precisa de loja.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {podeInstalarDireto ? (
          <Button onClick={instalar}>
            <Download className="size-4" aria-hidden /> Instalar app
          </Button>
        ) : (
          <Button onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
            {aberto ? "Esconder o passo a passo" : "Como instalar"}
          </Button>
        )}
        {podeInstalarDireto && (
          <Button variante="fantasma" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
            Passo a passo
          </Button>
        )}
      </div>

      {aberto && (
        <div className="mt-5 space-y-4">
          <div className="inline-flex rounded-xl border border-borda bg-superficie p-1" role="tablist" aria-label="Seu celular">
            {(["android", "iphone"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={aba === s}
                onClick={() => setAba(s)}
                className={cn("rounded-lg px-4 py-1.5 text-sm font-bold", aba === s ? "bg-marca text-sobre-marca" : "text-suave hover:text-texto")}
              >
                {s === "android" ? "Android" : "iPhone"}
                {sistema === s && " (o seu)"}
              </button>
            ))}
          </div>
          {aba === "android" ? (
            <Passos
              aviso="Use o Google Chrome."
              passos={[
                <>
                  Toque nos <strong>três pontinhos</strong> <EllipsisVertical className="inline size-4 align-[-3px]" aria-hidden /> no canto de cima, à direita.
                </>,
                <>
                  Toque em <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>).
                </>,
                <>
                  Confirme em <strong>Instalar</strong>. O ícone aparece na tela inicial do celular.
                </>,
              ]}
            />
          ) : (
            <Passos
              aviso="Use o Safari (no Chrome do iPhone também funciona: o botão Compartilhar fica ao lado do endereço)."
              passos={[
                <>
                  Toque no botão <strong>Compartilhar</strong> <Share className="inline size-4 align-[-3px]" aria-hidden /> (o quadrado com a seta para
                  cima), na barra de baixo do Safari.
                </>,
                <>
                  Role a lista e toque em <strong>Adicionar à Tela de Início</strong>{" "}
                  <SquarePlus className="inline size-4 align-[-3px]" aria-hidden />.
                </>,
                <>
                  Toque em <strong>Adicionar</strong>, no canto de cima. O ícone aparece na tela inicial do iPhone.
                </>,
              ]}
            />
          )}
        </div>
      )}
    </section>
  );
}

function Passos({ aviso, passos }: { aviso: string; passos: React.ReactNode[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-suave">{aviso}</p>
      <ol className="space-y-2.5">
        {passos.map((p, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-marca text-xs font-extrabold text-sobre-marca">{i + 1}</span>
            <span className="pt-0.5">{p}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
