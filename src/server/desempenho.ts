import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { agoraEmSegundos, DESLOCAMENTO_SQLITE, diaLocal, ultimosDias } from "@/lib/datas";

export type Janela = {
  chave: "hoje" | "ontem" | "d7" | "d15" | "d30";
  rotulo: string;
  total: number;
  acertos: number;
  erros: number;
  percentual: number;
};

const ROTULOS: Record<Janela["chave"], string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  d7: "Últimos 7 dias",
  d15: "Últimos 15 dias",
  d30: "Últimos 30 dias",
};

// "Últimos 7 dias" inclui hoje: hoje e os 6 dias anteriores. Mesma lógica para 15 e 30.
// Todas as janelas saem de UMA consulta que só lê as respostas do aluno nos últimos 31 dias
// (índice respostas_usuario_data).
export async function obterJanelas(usuarioId: string): Promise<Janela[]> {
  const desde = agoraEmSegundos() - 31 * 24 * 60 * 60;
  const hoje = diaLocal();
  const ontem = diaLocal(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const inicio7 = ultimosDias(7)[0]!;
  const inicio15 = ultimosDias(15)[0]!;
  const inicio30 = ultimosDias(30)[0]!;

  const [linha] = await db.all<Record<string, number | null>>(sql`
    WITH r AS (
      SELECT correta, date(respondida_em, 'unixepoch', ${DESLOCAMENTO_SQLITE}) AS dia
      FROM respostas
      WHERE usuario_id = ${usuarioId} AND respondida_em >= ${desde}
    )
    SELECT
      SUM(dia = ${hoje})                     AS hoje_total,
      SUM(dia = ${hoje} AND correta)         AS hoje_acertos,
      SUM(dia = ${ontem})                    AS ontem_total,
      SUM(dia = ${ontem} AND correta)        AS ontem_acertos,
      SUM(dia >= ${inicio7})                 AS d7_total,
      SUM(dia >= ${inicio7} AND correta)     AS d7_acertos,
      SUM(dia >= ${inicio15})                AS d15_total,
      SUM(dia >= ${inicio15} AND correta)    AS d15_acertos,
      SUM(dia >= ${inicio30})                AS d30_total,
      SUM(dia >= ${inicio30} AND correta)    AS d30_acertos
    FROM r
  `);

  return (Object.keys(ROTULOS) as Janela["chave"][]).map((chave) => {
    const total = Number(linha?.[`${chave}_total`] ?? 0);
    const acertos = Number(linha?.[`${chave}_acertos`] ?? 0);
    return {
      chave,
      rotulo: ROTULOS[chave],
      total,
      acertos,
      erros: total - acertos,
      percentual: total ? Math.round((acertos / total) * 100) : 0,
    };
  });
}

export type PontoDia = { dia: string; acertos: number; erros: number };

/** Série diária dos últimos 30 dias, com zeros nos dias sem estudo (para o gráfico). */
export async function obterSerieDiaria(usuarioId: string, dias = 30): Promise<PontoDia[]> {
  const desde = agoraEmSegundos() - (dias + 1) * 24 * 60 * 60;
  const linhas = await db.all<{ dia: string; total: number; acertos: number }>(sql`
    SELECT date(respondida_em, 'unixepoch', ${DESLOCAMENTO_SQLITE}) AS dia,
           COUNT(*) AS total,
           SUM(correta) AS acertos
    FROM respostas
    WHERE usuario_id = ${usuarioId} AND respondida_em >= ${desde}
    GROUP BY dia
  `);
  const porDia = new Map(linhas.map((l) => [l.dia, l]));
  return ultimosDias(dias).map((dia) => {
    const l = porDia.get(dia);
    const acertos = Number(l?.acertos ?? 0);
    return { dia, acertos, erros: Number(l?.total ?? 0) - acertos };
  });
}

export type DesempenhoDisciplina = {
  disciplina: string;
  total: number;
  acertos: number;
  erros: number;
  percentual: number;
};

/** Desempenho por disciplina nos últimos `dias` dias, ordenado por volume. */
export async function obterPorDisciplina(
  usuarioId: string,
  dias = 30,
): Promise<DesempenhoDisciplina[]> {
  const desde = agoraEmSegundos() - dias * 24 * 60 * 60;
  const linhas = await db.all<{ disciplina: string; total: number; acertos: number }>(sql`
    SELECT d.nome AS disciplina, COUNT(*) AS total, SUM(r.correta) AS acertos
    FROM respostas r
    JOIN questoes q ON q.id = r.questao_id
    JOIN disciplinas d ON d.id = q.disciplina_id
    WHERE r.usuario_id = ${usuarioId} AND r.respondida_em >= ${desde}
    GROUP BY d.id
    ORDER BY total DESC
  `);
  return linhas.map((l) => {
    const total = Number(l.total);
    const acertos = Number(l.acertos ?? 0);
    return {
      disciplina: l.disciplina,
      total,
      acertos,
      erros: total - acertos,
      percentual: total ? Math.round((acertos / total) * 100) : 0,
    };
  });
}
