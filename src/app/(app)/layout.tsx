import { AvisoConfirmarEmail } from "@/components/aviso-confirmar-email";
import { Navegacao } from "@/components/navegacao";
import { ehAdmin, exigirUsuario } from "@/lib/sessao";

// Tudo dentro de (app) exige login.
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  return (
    <>
      <Navegacao nome={usuario.name} admin={ehAdmin(usuario.email)} />
      {!usuario.emailVerified && <AvisoConfirmarEmail email={usuario.email} />}
      {/* No celular sobra espaço embaixo para a barra de abas fixa (h-16 + área segura do iPhone). */}
      <main className="mx-auto max-w-4xl px-5 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:py-8">{children}</main>
    </>
  );
}
