import { MenuAdmin } from "@/components/admin/menu-admin";
import { exigirAdmin } from "@/lib/sessao";

// Área do dono. Mais larga que as telas do aluno: sai da coluna de 4xl do layout (app),
// centralizada, até 72rem (sem passar da largura da tela).
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await exigirAdmin();
  return (
    <div className="relative left-1/2 w-[min(100vw-2.5rem,72rem)] -translate-x-1/2">
      <div className="grid gap-6 md:grid-cols-[200px_1fr] md:gap-8">
        <aside>
          <MenuAdmin />
        </aside>
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
