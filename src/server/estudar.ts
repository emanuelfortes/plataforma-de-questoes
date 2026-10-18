import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assuntos, contagens, disciplinas } from "@/db/schema";

// Dados da tela "Estudar" (escolha de tipo, matéria e área). Tudo sai de "contagens",
// nunca de COUNT(*) sobre questoes ou flashcards.

export type TipoEstudo = "questoes" | "flashcards";
const PREFIXO: Record<TipoEstudo, "q" | "f"> = { questoes: "q", flashcards: "f" };

async function lerContagens(chaves: string[]) {
  if (!chaves.length) return new Map<string, number>();
  const linhas = await db
    .select({ chave: contagens.chave, total: contagens.total })
    .from(contagens)
    .where(inArray(contagens.chave, chaves));
  return new Map(linhas.map((l) => [l.chave, l.total]));
}

export async function totaisPorTipo() {
  const totais = await lerContagens(["q:total", "f:total"]);
  return { questoes: totais.get("q:total") ?? 0, flashcards: totais.get("f:total") ?? 0 };
}

/** Matérias com pelo menos um item do tipo escolhido. */
export async function listarMaterias(tipo: TipoEstudo) {
  const todas = await db.select().from(disciplinas).orderBy(asc(disciplinas.nome));
  const p = PREFIXO[tipo];
  const totais = await lerContagens(todas.map((d) => `${p}:d:${d.id}`));
  return todas
    .map((d) => ({ ...d, total: totais.get(`${p}:d:${d.id}`) ?? 0 }))
    .filter((d) => d.total > 0);
}

/** Áreas da matéria com pelo menos um item. */
export async function detalharMateria(tipo: TipoEstudo, disciplinaId: number) {
  const [disciplina] = await db.select().from(disciplinas).where(eq(disciplinas.id, disciplinaId));
  if (!disciplina) return null;

  const areas = await db
    .select({ id: assuntos.id, nome: assuntos.nome })
    .from(assuntos)
    .where(eq(assuntos.disciplinaId, disciplinaId))
    .orderBy(asc(assuntos.nome));

  const p = PREFIXO[tipo];
  const chaveMateria = `${p}:d:${disciplinaId}`;
  const totais = await lerContagens([chaveMateria, ...areas.map((a) => `${p}:a:${a.id}`)]);

  return {
    disciplina,
    total: totais.get(chaveMateria) ?? 0,
    areas: areas
      .map((a) => ({ ...a, total: totais.get(`${p}:a:${a.id}`) ?? 0 }))
      .filter((a) => a.total > 0),
  };
}

/** Nomes para o cabeçalho "Matéria · Área" das telas de questões e flashcards. */
export async function nomesSelecao(disciplinaId?: number, assuntoIds: number[] = []) {
  const [d] = disciplinaId
    ? await db.select({ nome: disciplinas.nome }).from(disciplinas).where(eq(disciplinas.id, disciplinaId))
    : [];
  const areas = assuntoIds.length
    ? await db
        .select({ nome: assuntos.nome })
        .from(assuntos)
        .where(inArray(assuntos.id, assuntoIds))
        .orderBy(asc(assuntos.nome))
    : [];
  return { disciplina: d?.nome, assunto: areas.map((a) => a.nome).join(" + ") || undefined };
}

export type MateriaArvore = {
  id: number;
  nome: string;
  total: number;
  areas: { id: number; nome: string; total: number }[];
};

/**
 * Árvore da tela Estudar (pastas no estilo do TEC): matérias com conteúdo do tipo escolhido e,
 * dentro, as áreas com conteúdo. Três consultas no total, com contagens de "contagens".
 */
export async function arvoreDeEstudo(tipo: TipoEstudo): Promise<MateriaArvore[]> {
  const p = PREFIXO[tipo];
  const [ds, as] = await Promise.all([
    db.select().from(disciplinas).orderBy(asc(disciplinas.nome)),
    db.select({ id: assuntos.id, nome: assuntos.nome, disciplinaId: assuntos.disciplinaId }).from(assuntos).orderBy(asc(assuntos.nome)),
  ]);
  const totais = await lerContagens([...ds.map((d) => `${p}:d:${d.id}`), ...as.map((a) => `${p}:a:${a.id}`)]);
  return ds
    .map((d) => ({
      id: d.id,
      nome: d.nome,
      total: totais.get(`${p}:d:${d.id}`) ?? 0,
      areas: as
        .filter((a) => a.disciplinaId === d.id)
        .map((a) => ({ id: a.id, nome: a.nome, total: totais.get(`${p}:a:${a.id}`) ?? 0 }))
        .filter((a) => a.total > 0),
    }))
    .filter((d) => d.total > 0);
}
