import "server-only";
import { countDistinct, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { respostas } from "@/db/schema";
import { DESLOCAMENTO_MS, diaLocal, inicioDoDiaLocal } from "@/lib/datas";

// Uso da plataforma para a visão geral do dono: questões resolvidas hoje e no mês e quanto isso pesa na
// cota de escritas do Turso. Sem COUNT(*) em respostas: o id cresce junto com o tempo, então o total
// desde uma data é (maior id) - (primeiro id da data) + 1, achado por busca binária (umas 25 leituras).

/** Plano grátis do Turso: linhas gravadas por mês. */
export const COTA_ESCRITAS_MES = 10_000_000;
/** Cada questão resolvida grava até 3 linhas: a resposta, o status da questão e o placar do ranking. */
export const ESCRITAS_POR_RESPOSTA = 3;
/** Quantas questões resolvidas cabem no mês dentro da cota (arredondado para baixo). */
export const RESPOSTAS_POR_MES = Math.floor(COTA_ESCRITAS_MES / ESCRITAS_POR_RESPOSTA);

async function maiorId() {
  const [r] = await db.select({ id: sql<number | null>`max(${respostas.id})` }).from(respostas);
  return Number(r?.id ?? 0);
}

/** Data da resposta com o menor id >= id (uma leitura pela chave). */
async function dataAPartirDe(id: number) {
  const [r] = await db
    .select({ id: respostas.id, em: respostas.respondidaEm })
    .from(respostas)
    .where(gte(respostas.id, id))
    .orderBy(respostas.id)
    .limit(1);
  return r ?? null;
}

/** Primeiro id respondido a partir de `desde` (ou null se não houver nenhum). */
async function primeiroIdDesde(desde: Date, ate: number) {
  let baixo = 1;
  let alto = ate;
  let achado: number | null = null;
  while (baixo <= alto) {
    const meio = Math.floor((baixo + alto) / 2);
    const r = await dataAPartirDe(meio);
    if (!r) {
      alto = meio - 1;
    } else if (r.em >= desde) {
      achado = r.id;
      alto = meio - 1;
    } else {
      baixo = r.id + 1;
    }
  }
  return achado;
}

/** Instante (UTC) em que começou o mês atual no fuso de Brasília. */
function inicioDoMesLocal() {
  return new Date(Date.parse(`${diaLocal().slice(0, 7)}-01T00:00:00Z`) - DESLOCAMENTO_MS);
}

export async function usoDaPlataforma() {
  const ultimo = await maiorId();
  const inicioMes = inicioDoMesLocal();
  const inicioHoje = inicioDoDiaLocal();
  const [primeiroMes, primeiroHoje] = ultimo
    ? await Promise.all([primeiroIdDesde(inicioMes, ultimo), primeiroIdDesde(inicioHoje, ultimo)])
    : [null, null];
  const desde = (primeiro: number | null) => (primeiro ? ultimo - primeiro + 1 : 0);

  // Alunos que estudaram hoje: lê só as respostas de hoje (a partir do primeiro id do dia).
  const [hoje] = primeiroHoje
    ? await db.select({ n: countDistinct(respostas.usuarioId) }).from(respostas).where(gte(respostas.id, primeiroHoje))
    : [{ n: 0 }];

  const resolvidasMes = desde(primeiroMes);
  const agora = Date.now();
  const fimMes = new Date(inicioMes);
  fimMes.setUTCMonth(fimMes.getUTCMonth() + 1);
  const diasPassados = Math.max(1, (agora - inicioMes.getTime()) / 86_400_000);
  const diasDoMes = (fimMes.getTime() - inicioMes.getTime()) / 86_400_000;
  const mediaDia = resolvidasMes / diasPassados;

  return {
    resolvidasHoje: desde(primeiroHoje),
    alunosHoje: hoje?.n ?? 0,
    resolvidasMes,
    mediaDia: Math.round(mediaDia),
    /** No ritmo atual, quantas o mês vai fechar. */
    projecaoMes: Math.round(mediaDia * diasDoMes),
    capacidadeMes: RESPOSTAS_POR_MES,
  };
}
