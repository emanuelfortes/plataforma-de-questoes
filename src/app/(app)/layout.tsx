import { Navegacao } from "@/components/navegacao";
import { exigirUsuario } from "@/lib/sessao";

// Tudo dentro de (app) exige login.
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  return (
    <>
      <Navegacao nome={usuario.name} />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </>
  );
}
