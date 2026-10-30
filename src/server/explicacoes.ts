import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { explicacoesArtigo } from "@/db/schema";
import type { Explicacao, StatusExplicacao } from "@/lib/explicacao";

// Explicações do Vade Mecum. O aluno só vê as aprovadas; o professor revisa as pendentes em /admin/vade-mecum.

/** Explicações aprovadas dos artigos de uma seção (chave do artigo: "121", "5", "121-A"). */
export async function explicacoesAprovadas(lei: string, artigos: string[]): Promise<Record<string, Explicacao>> {
  if (!artigos.length) return {};
  try {
    const linhas = await db
      .select()
      .from(explicacoesArtigo)
      .where(and(eq(explicacoesArtigo.lei, lei), inArray(explicacoesArtigo.artigo, [...new Set(artigos)]), eq(explicacoesArtigo.status, "aprovada")));
    return Object.fromEntries(linhas.map((l) => [l.artigo, { sentido: l.sentido, pontos: l.pontos, exemplo: l.exemplo, pegadinha: l.pegadinha }]));
  } catch {
    // Tabela ainda não criada neste banco (scripts/publicacao/explicacoes.ts): o leitor segue sem explicações.
    return {};
  }
}

export async function resumoExplicacoes() {
  const linhas = await db.select({ status: explicacoesArtigo.status, n: count() }).from(explicacoesArtigo).groupBy(explicacoesArtigo.status);
  const por = Object.fromEntries(linhas.map((l) => [l.status, l.n])) as Partial<Record<StatusExplicacao, number>>;
  return { pendente: por.pendente ?? 0, aprovada: por.aprovada ?? 0, rejeitada: por.rejeitada ?? 0 };
}

/** Explicações de um status, para a fila do professor (as com algo a conferir primeiro). */
export async function listarExplicacoes(status: StatusExplicacao, limite = 20) {
  const linhas = await db
    .select()
    .from(explicacoesArtigo)
    .where(eq(explicacoesArtigo.status, status))
    .orderBy(asc(explicacoesArtigo.lei), asc(explicacoesArtigo.artigo))
    .limit(limite * 3);
  // Quem tem observação para conferir vem antes.
  return linhas.sort((a, b) => Number(!a.conferir) - Number(!b.conferir)).slice(0, limite);
}
