import Link from "next/link";
import { Logo } from "@/components/logo";
import { LEGAL, linkWhatsapp, whatsappFormatado } from "@/lib/legal";
import { NOME_PLATAFORMA } from "@/lib/marca";
import { BotaoTema } from "@/components/botao-tema";

/** Moldura das páginas públicas de texto (termos e privacidade). */
export function PaginaLegal({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <div className="flex items-center">
        <Link href="/" className="flex items-center gap-2.5 font-extrabold">
          <Logo tamanho={40} />
          <span>{NOME_PLATAFORMA}</span>
        </Link>
        <BotaoTema className="-mr-2 ml-auto" />
      </div>
      <h1 className="mt-8 text-[34px] font-extrabold leading-[1.1] tracking-[-.03em]">{titulo}</h1>
      <p className="mt-2 text-sm text-suave">Última atualização: {LEGAL.atualizadoEm}</p>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-texto/85 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-texto [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_a]:font-bold [&_a]:text-marca-clara [&_a:hover]:underline">
        {children}
      </div>
      <p className="mt-12 border-t border-borda pt-6 text-sm text-suave">
        <Link href="/termos">Termos de uso</Link> · <Link href="/privacidade">Política de privacidade</Link> ·{" "}
        <ContatoWhatsapp />
      </p>
    </main>
  );
}

/** "Riccardo Nóbrega (CNPJ ...)" quando houver documento. */
export function Responsavel() {
  return (
    <strong>
      {LEGAL.responsavel}
      {LEGAL.documento && ` (${LEGAL.documento})`}
    </strong>
  );
}

/** Link de atendimento pelo WhatsApp, com a mensagem inicial já escrita. */
export function ContatoWhatsapp({ mensagem = "Olá! Vim pela plataforma Nóbrega Questões." }: { mensagem?: string }) {
  return (
    <a href={linkWhatsapp(mensagem)} target="_blank" rel="noopener noreferrer">
      WhatsApp {whatsappFormatado()}
    </a>
  );
}
