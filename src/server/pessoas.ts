import "server-only";
import { count, desc, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { assinaturas, contagens, statusQuestao, user } from "@/db/schema";
import { ehAdmin } from "@/lib/admin";

// Dados da área do dono sobre as pessoas da plataforma. A tabela de usuários é pequena
// (milhares, não milhões), então a classificação é feita em memória.

export type Situacao = "assinante" | "cancelado" | "pendente" | "gratis" | "equipe";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  assinante: "Assinante",
  cancelado: "Cancelou (ainda com acesso)",
  pendente: "Pagamento pendente",
  gratis: "Plano grátis",
  equipe: "Equipe",
};

type UltimaAssinatura = { status: string; acessoAte: Date | null };

function classificar(email: string, a: UltimaAssinatura | undefined): Situacao {
  if (ehAdmin(email)) return "equipe";
  if (!a) return "gratis";
  if (a.status === "authorized") return "assinante";
  if (a.acessoAte && a.acessoAte.getTime() > Date.now()) return "cancelado";
  if (a.status === "pending") return "pendente";
  return "gratis";
}

/** Última assinatura de cada aluno (a mais recente vale). */
async function ultimasAssinaturas() {
  const linhas = await db
    .select({
      usuarioId: assinaturas.usuarioId,
      status: assinaturas.status,
      acessoAte: assinaturas.acessoAte,
      atualizadaEm: assinaturas.atualizadaEm,
    })
    .from(assinaturas)
    .orderBy(desc(assinaturas.atualizadaEm));
  const mapa = new Map<string, UltimaAssinatura>();
  for (const l of linhas) if (!mapa.has(l.usuarioId)) mapa.set(l.usuarioId, l);
  return mapa;
}

async function todasAsPessoas() {
  const [pessoas, assinaturasPorUsuario] = await Promise.all([
    db
      .select({
        id: user.id,
        nome: user.name,
        email: user.email,
        emailConfirmado: user.emailVerified,
        criadoEm: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt)),
    ultimasAssinaturas(),
  ]);
  return pessoas.map((p) => ({ ...p, situacao: classificar(p.email, assinaturasPorUsuario.get(p.id)) }));
}

/** Totais para os cards da área do dono. */
export async function resumoPessoas() {
  const pessoas = await todasAsPessoas();
  const dias = (n: number) => Date.now() - n * 24 * 60 * 60 * 1000;
  const porSituacao = Object.fromEntries(
    (Object.keys(ROTULO_SITUACAO) as Situacao[]).map((s) => [s, pessoas.filter((p) => p.situacao === s).length]),
  ) as Record<Situacao, number>;
  const alunos = pessoas.length - porSituacao.equipe;
  return {
    cadastrados: alunos,
    novos7: pessoas.filter((p) => p.situacao !== "equipe" && p.criadoEm.getTime() >= dias(7)).length,
    novos30: pessoas.filter((p) => p.situacao !== "equipe" && p.criadoEm.getTime() >= dias(30)).length,
    confirmados: pessoas.filter((p) => p.situacao !== "equipe" && p.emailConfirmado).length,
    porSituacao,
    /** Assinantes ativos sobre o total de alunos, em %. */
    conversao: alunos ? Math.round((porSituacao.assinante / alunos) * 1000) / 10 : 0,
    recentes: pessoas.filter((p) => p.situacao !== "equipe").slice(0, 5),
  };
}

export const POR_PAGINA = 50;
export type FiltroPessoas = Situacao | "todos";

/** Lista para a tabela de pessoas, com filtro por situação, busca e página. */
export async function listarPessoas({ filtro, busca, pagina }: { filtro: FiltroPessoas; busca: string; pagina: number }) {
  const termo = busca.trim().toLowerCase();
  const filtradas = (await todasAsPessoas()).filter(
    (p) =>
      (filtro === "todos" || p.situacao === filtro) &&
      (!termo || p.nome.toLowerCase().includes(termo) || p.email.toLowerCase().includes(termo)),
  );
  const daPagina = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  // Questões resolvidas só de quem aparece na página (status_questao: uma linha por questão resolvida).
  const ids = daPagina.map((p) => p.id);
  const resolvidas = ids.length
    ? await db
        .select({ usuarioId: statusQuestao.usuarioId, n: count() })
        .from(statusQuestao)
        .where(inArray(statusQuestao.usuarioId, ids))
        .groupBy(statusQuestao.usuarioId)
    : [];
  const porUsuario = new Map(resolvidas.map((r) => [r.usuarioId, r.n]));

  return {
    total: filtradas.length,
    paginas: Math.max(1, Math.ceil(filtradas.length / POR_PAGINA)),
    pessoas: daPagina.map((p) => ({ ...p, resolvidas: porUsuario.get(p.id) ?? 0 })),
  };
}

/** Tamanho do banco de conteúdo (de "contagens", nunca COUNT(*) em questoes). */
export async function totaisConteudo() {
  const linhas = await db
    .select({ chave: contagens.chave, total: contagens.total })
    .from(contagens)
    .where(inArray(contagens.chave, ["q:total", "f:total"]));
  const mapa = new Map(linhas.map((l) => [l.chave, l.total]));
  return { questoes: mapa.get("q:total") ?? 0, flashcards: mapa.get("f:total") ?? 0 };
}

/** Novos cadastros por dia nos últimos 30 dias (fuso de Brasília), para o gráfico da visão geral. */
export async function cadastrosPorDia() {
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db.all<{ dia: string; n: number }>(sql`
    SELECT strftime('%Y-%m-%d', ${user.createdAt}, 'unixepoch', '-3 hours') AS dia, COUNT(*) AS n
    FROM ${user} WHERE ${user.createdAt} >= ${Math.floor(desde.getTime() / 1000)}
    GROUP BY dia ORDER BY dia`);
}

