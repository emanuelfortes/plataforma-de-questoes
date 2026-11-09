import { ehAdmin, obterSessao } from "@/lib/sessao";
import { temElite } from "@/server/assinatura";
import { arquivoDoSimulado, BASE_COMENTADO, infoComentado, partesDoPdf, podeBaixarComentado } from "@/server/simulados";

// PDFs do simulado: só para o Elite (e o dono). Saem em fluxo, uma parte do banco por vez.
//   /api/simulados/<id>/pdf                 caderno de questões (para imprimir e fazer a prova)
//   /api/simulados/<id>/pdf?tipo=comentado  gabarito comentado: só depois que o aluno entrega a prova
export async function GET(requisicao: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessao();
  if (!sessao) return new Response("entre na sua conta", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response("não encontrado", { status: 404 });
  if (!(await temElite(sessao.user))) return new Response("os simulados são da Tropa de Elite", { status: 403 });

  const dono = ehAdmin(sessao.user.email);
  const arquivo = await arquivoDoSimulado(id, dono);
  if (!arquivo?.arquivoBytes) return new Response("não encontrado", { status: 404 });

  const comentado = new URL(requisicao.url).searchParams.get("tipo") === "comentado";
  let partes: AsyncGenerator<Uint8Array>;
  let bytes: number;
  if (comentado) {
    if (!dono && !(await podeBaixarComentado(id, sessao.user.id))) {
      return new Response("o gabarito comentado libera depois que você entrega a prova", { status: 403 });
    }
    const info = await infoComentado(id);
    if (!info) return new Response("não encontrado", { status: 404 });
    partes = partesDoPdf(id, info.partes, BASE_COMENTADO);
    bytes = info.bytes;
  } else {
    partes = partesDoPdf(id, arquivo.partes);
    bytes = arquivo.arquivoBytes;
  }

  const corpo = new ReadableStream<Uint8Array>({
    async pull(controle) {
      const { value, done } = await partes.next();
      if (done) controle.close();
      else controle.enqueue(value);
    },
  });
  const base = arquivo.titulo.normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "simulado";
  const nome = `${base}${comentado ? "-gabarito-comentado" : ""}.pdf`;
  return new Response(corpo, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes),
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
