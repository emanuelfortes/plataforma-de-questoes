import "server-only";
import { and, asc, count, desc, eq, gt, gte, isNull, lt, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { placar, user } from "@/db/schema";
import { ehAdmin } from "@/lib/admin";

// Ranking dos alunos. Tudo sai de "placar" (uma linha por aluno, atualizada a cada resposta), nunca do
// histórico de respostas: o custo não cresce com o número de questões resolvidas.

export type TipoRanking = "fuzil" | "mira";

/** Bom de Mira só considera quem já resolveu isto (sem isso, 1 de 1 seria 100% e ficaria em primeiro). */
export const MINIMO_MIRA = 30;
export const TAMANHO_RANKING = 50;

export type LinhaRanking = {
  posicao: number;
  usuarioId: string;
  nome: string;
  resolvidas: number;
  acertos: number;
  percentual: number;
};

/** "João Carlos da Silva" vira "João S.": o ranking é público entre os alunos; nunca mostra e-mail. */
function nomeCurto(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "Aluno";
  const primeiro = partes[0]!;
  const ultimo = partes.length > 1 ? partes[partes.length - 1]! : "";
  return ultimo ? `${primeiro} ${ultimo.charAt(0).toUpperCase()}.` : primeiro;
}

const percentual = (acertos: number, resolvidas: number) => (resolvidas ? Math.round((100 * acertos) / resolvidas) : 0);
const taxa = sql`1.0 * ${placar.acertos} / ${placar.resolvidas}`;
/** Pontos do Fuzil (mesma conta de pontosFuzil em src/lib/patentes.ts). */
const pontos = sql`${placar.resolvidas} + ${placar.acertos}`;

/** A conta do dono (ADMIN_EMAILS) não entra no ranking dos alunos. */
function semDonos(): SQL | undefined {
  const donos = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return donos.length ? notInArray(sql`lower(${user.email})`, donos) : undefined;
}

export async function obterRanking(tipo: TipoRanking, usuarioId: string, email: string) {
  // O dono fica fora da lista; sem isto ele via "1º de 1" com as próprias questões.
  const dono = ehAdmin(email);
  const participa = tipo === "fuzil" ? gt(placar.resolvidas, 0) : gte(placar.resolvidas, MINIMO_MIRA);
  const filtro = and(participa, semDonos());

  // O resto da tropa: alunos que ainda não entram neste ranking (sem questões, ou abaixo do mínimo do Bom de Mira).
  const resolvidasOuZero = sql<number>`coalesce(${placar.resolvidas}, 0)`;
  const foraDoRanking = tipo === "fuzil" ? isNull(placar.resolvidas) : or(isNull(placar.resolvidas), lt(placar.resolvidas, MINIMO_MIRA));

  const [linhas, [eu], [{ participantes } = { participantes: 0 }], outros] = await Promise.all([
    db
      .select({ usuarioId: placar.usuarioId, nome: user.name, resolvidas: placar.resolvidas, acertos: placar.acertos })
      .from(placar)
      .innerJoin(user, eq(user.id, placar.usuarioId))
      .where(filtro)
      .orderBy(...(tipo === "fuzil" ? [desc(pontos), desc(placar.resolvidas)] : [desc(taxa), desc(placar.resolvidas)]), asc(placar.atualizadoEm))
      .limit(TAMANHO_RANKING),
    db.select({ resolvidas: placar.resolvidas, acertos: placar.acertos }).from(placar).where(eq(placar.usuarioId, usuarioId)),
    db.select({ participantes: count() }).from(placar).innerJoin(user, eq(user.id, placar.usuarioId)).where(filtro),
    db
      .select({ usuarioId: user.id, nome: user.name, resolvidas: resolvidasOuZero })
      .from(user)
      .leftJoin(placar, eq(placar.usuarioId, user.id))
      .where(and(tipo === "fuzil" ? or(foraDoRanking, eq(placar.resolvidas, 0)) : foraDoRanking, semDonos()))
      .orderBy(desc(resolvidasOuZero), asc(user.createdAt))
      .limit(TAMANHO_RANKING),
  ]);
  const tropa = outros.map((o) => ({ usuarioId: o.usuarioId, nome: nomeCurto(o.nome), resolvidas: Number(o.resolvidas) }));

  const lista: LinhaRanking[] = linhas.map((l, i) => ({
    posicao: i + 1,
    usuarioId: l.usuarioId,
    nome: nomeCurto(l.nome),
    resolvidas: l.resolvidas,
    acertos: l.acertos,
    percentual: percentual(l.acertos, l.resolvidas),
  }));

  // Posição do aluno mesmo fora do top 50: quantos estão na frente dele, mais um.
  const meus = { resolvidas: eu?.resolvidas ?? 0, acertos: eu?.acertos ?? 0 };
  const entra = !dono && (tipo === "fuzil" ? meus.resolvidas > 0 : meus.resolvidas >= MINIMO_MIRA);
  let posicao: number | null = lista.find((l) => l.usuarioId === usuarioId)?.posicao ?? null;
  if (entra && posicao === null) {
    const frente =
      tipo === "fuzil"
        ? sql`${pontos} > ${meus.resolvidas + meus.acertos}`
        : sql`${taxa} > ${meus.acertos / meus.resolvidas}`;
    const [{ n } = { n: 0 }] = await db
      .select({ n: count() })
      .from(placar)
      .innerJoin(user, eq(user.id, placar.usuarioId))
      .where(and(filtro, frente));
    posicao = n + 1;
  }

  return {
    lista,
    tropa,
    participantes,
    eu: {
      ...meus,
      dono,
      percentual: percentual(meus.acertos, meus.resolvidas),
      posicao: entra ? posicao : null,
      faltamParaMira: Math.max(MINIMO_MIRA - meus.resolvidas, 0),
    },
  };
}
