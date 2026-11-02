import { ehAdmin, obterSessao } from "@/lib/sessao";
import { temElite } from "@/server/assinatura";
import { arquivoDoSimulado, partesDoPdf } from "@/server/simulados";

// PDF do simulado: só para o Elite (e o dono). Sai em fluxo, uma parte do banco por vez.
export async function GET(_requisicao: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessao();
  if (!sessao) return new Response("entre na sua conta", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response("não encontrado", { status: 404 });
  if (!(await temElite(sessao.user))) return new Response("os simulados são do plano Elite", { status: 403 });

  const arquivo = await arquivoDoSimulado(id, ehAdmin(sessao.user.email));
  if (!arquivo?.arquivoBytes) return new Response("não encontrado", { status: 404 });

  const partes = partesDoPdf(id, arquivo.partes);
  const corpo = new ReadableStream<Uint8Array>({
    async pull(controle) {
      const { value, done } = await partes.next();
      if (done) controle.close();
      else controle.enqueue(value);
    },
  });
  const nome = `${arquivo.titulo.normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "simulado"}.pdf`;
  return new Response(corpo, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(arquivo.arquivoBytes),
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
