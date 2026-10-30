"use server";

// Ações do professor sobre as explicações do Vade Mecum. Todas começam com exigirAdmin().
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { explicacoesArtigo } from "@/db/schema";
import { esquemaExplicacao } from "@/lib/explicacao";
import { exigirAdmin } from "@/lib/sessao";

const chave = z.object({ lei: z.string().regex(/^[a-z0-9-]{2,30}$/), artigo: z.string().regex(/^\d{1,4}(-[A-Z])?$/) });
const decisao = z.enum(["aprovar", "salvar", "rejeitar"]);

export type ResultadoExplicacao = { ok: true } | { ok: false; erro: string };

/** Aprova (o aluno passa a ver), só salva a edição, ou rejeita. */
export async function decidirExplicacao(id: unknown, campos: unknown, acao: unknown): Promise<ResultadoExplicacao> {
  const usuario = await exigirAdmin();
  const k = chave.safeParse(id);
  const d = decisao.safeParse(acao);
  if (!k.success || !d.success) return { ok: false, erro: "Pedido inválido." };
  const c = d.data === "rejeitar" ? null : esquemaExplicacao.safeParse(campos);
  if (c && !c.success) return { ok: false, erro: c.error.issues[0]!.message };

  const status = d.data === "aprovar" ? "aprovada" : d.data === "rejeitar" ? "rejeitada" : "pendente";
  const feito = await db
    .update(explicacoesArtigo)
    .set({
      ...(c?.success ? { sentido: c.data.sentido, pontos: c.data.pontos, exemplo: c.data.exemplo, pegadinha: c.data.pegadinha || null } : {}),
      status,
      ...(d.data === "salvar" ? {} : { revisadoEm: new Date(), revisadoPor: usuario.email }),
    })
    .where(and(eq(explicacoesArtigo.lei, k.data.lei), eq(explicacoesArtigo.artigo, k.data.artigo)))
    .returning({ lei: explicacoesArtigo.lei });
  if (!feito.length) return { ok: false, erro: "Explicação não encontrada." };
  revalidatePath("/admin/vade-mecum");
  revalidatePath(`/vade-mecum/${k.data.lei}`);
  return { ok: true };
}
