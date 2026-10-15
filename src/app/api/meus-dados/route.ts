import { exigirUsuario } from "@/lib/sessao";
import { exportarDados } from "@/server/conta";

// LGPD: o aluno baixa uma cópia de tudo que guardamos sobre ele.
export async function GET() {
  const usuario = await exigirUsuario();
  const dados = await exportarDados(usuario.id);
  return new Response(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="meus-dados.json"',
      "Cache-Control": "no-store",
    },
  });
}
