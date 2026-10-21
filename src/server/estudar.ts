import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assuntos, contagens, disciplinas } from "@/db/schema";
import { chaveNome } from "@/lib/catalogo";
import type { GrupoSelecao } from "@/lib/filtros";
import { entradasDaMateria, nomeDaEntrada, type EntradaOrdem } from "@/lib/ordem-areas";

// Dados da tela "Estudar" (escolha de tipo, matéria e área). Tudo sai de "contagens",
// nunca de COUNT(*) sobre questoes ou flashcards.

/**
 * Ordem e pastas das áreas na tela de filtro (data/ordem-areas.json, lido por src/lib/ordem-areas.ts):
 * a ordem do conteúdo (no Penal, a do Código), não a alfabética. Pastas podem ter pastas dentro
 * (Crimes contra a Pessoa > Crimes contra a Vida > Feminicídio). No banco as áreas continuam soltas;
 * a pasta é só da tela. Área fora da lista vai para o fim, em ordem alfabética (já vem assim do banco).
 */
export type AreaArvore = { id: number; nome: string; total: number };
export type ItemArvore =
  | { tipo: "area"; area: AreaArvore }
  | { tipo: "pasta"; nome: string; total: number; itens: ItemArvore[] };

/** Ids de todas as áreas dentro de um item (a área ou tudo o que a pasta tem). */
export function areasDoItem(item: ItemArvore): AreaArvore[] {
  return item.tipo === "area" ? [item.area] : item.itens.flatMap(areasDoItem);
}

function organizarAreas(materia: string, areas: AreaArvore[]): ItemArvore[] {
  const sobrando = new Map(areas.map((a) => [chaveNome(a.nome), a]));
  const pegar = (nome: string) => {
    const a = sobrando.get(chaveNome(nome));
    sobrando.delete(chaveNome(nome));
    return a;
  };
  const montar = (entradas: EntradaOrdem[], pastaAtual?: string): ItemArvore[] =>
    entradas.flatMap((e): ItemArvore[] => {
      if (typeof e === "string" || !("pasta" in e)) {
        const nome = nomeDaEntrada(e);
        const a = pegar(nome);
        if (!a) return [];
        // Área com o mesmo nome da pasta guarda o resto do assunto: "Demais crimes contra a pessoa".
        const resto = pastaAtual && chaveNome(nome) === chaveNome(pastaAtual);
        return [{ tipo: "area", area: resto ? { ...a, nome: `Demais ${pastaAtual.toLowerCase()}` } : a }];
      }
      const itens = montar(e.areas, e.pasta);
      if (itens.length === 0) return [];
      // Pasta com um item só não ajuda: mostra o item solto (a área "Demais" volta a ter o nome da pasta).
      if (itens.length === 1) {
        const unico = itens[0]!;
        return [unico.tipo === "area" && unico.area.nome.startsWith("Demais ") ? { tipo: "area", area: { ...unico.area, nome: e.pasta } } : unico];
      }
      return [{ tipo: "pasta", nome: e.pasta, total: itens.flatMap(areasDoItem).reduce((t, a) => t + a.total, 0), itens }];
    });
  const itens = montar(entradasDaMateria(materia));
  for (const a of sobrando.values()) itens.push({ tipo: "area", area: a });
  return itens;
}

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

/**
 * Há questões de certo ou errado? Sem nenhuma, a opção "Tipo de questão" fica escondida: o filtro
 * percorreria a matéria inteira (linhas lidas na cota do Turso) para não achar nada.
 */
export async function temCertoErrado() {
  const totais = await lerContagens(["q:ce"]);
  return (totais.get("q:ce") ?? 0) > 0;
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

/**
 * Da URL (matérias e áreas soltas) para grupos por matéria. A área diz de qual matéria é; a matéria
 * que não tem área marcada vai inteira. Uma consulta pequena (só as áreas marcadas).
 */
export async function resolverSelecao(sel: { disciplinas: number[]; assuntos: number[] }): Promise<GrupoSelecao[]> {
  const areas = sel.assuntos.length
    ? await db
        .select({ id: assuntos.id, disciplinaId: assuntos.disciplinaId })
        .from(assuntos)
        .where(inArray(assuntos.id, sel.assuntos))
    : [];
  const grupos = new Map<number, number[]>(sel.disciplinas.map((d) => [d, []]));
  for (const a of areas) grupos.set(a.disciplinaId, [...(grupos.get(a.disciplinaId) ?? []), a.id]);
  return [...grupos].map(([disciplinaId, assuntoIds]) => ({ disciplinaId, assuntoIds }));
}

/** Nomes das matérias e áreas escolhidas (etiquetas da tela de questões e cabeçalho dos flashcards). */
export async function nomesSelecao(grupos: GrupoSelecao[]) {
  const ids = grupos.map((g) => g.disciplinaId);
  const areaIds = grupos.flatMap((g) => g.assuntoIds);
  const [ds, as] = await Promise.all([
    ids.length ? db.select({ id: disciplinas.id, nome: disciplinas.nome }).from(disciplinas).where(inArray(disciplinas.id, ids)) : [],
    areaIds.length
      ? db.select({ id: assuntos.id, nome: assuntos.nome, disciplinaId: assuntos.disciplinaId }).from(assuntos).where(inArray(assuntos.id, areaIds))
      : [],
  ]);
  const nomeMateria = new Map(ds.map((d) => [d.id, d.nome]));
  const materias = grupos.map((g) => ({ id: g.disciplinaId, nome: nomeMateria.get(g.disciplinaId) ?? "?", inteira: g.assuntoIds.length === 0 }));
  const areas = as.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  const resumo = grupos
    .map((g) => {
      const m = nomeMateria.get(g.disciplinaId) ?? "?";
      const nomes = areas.filter((a) => a.disciplinaId === g.disciplinaId).map((a) => a.nome);
      return nomes.length ? `${m} · ${nomes.join(" + ")}` : m;
    })
    .join("; ");
  return { materias, areas, resumo };
}

export type MateriaArvore = {
  id: number;
  nome: string;
  total: number;
  /** Todas as áreas, na ordem da tela (para achar nomes e totais da seleção). */
  areas: AreaArvore[];
  /** Como aparecem na árvore: áreas soltas e pastas de áreas. */
  itens: ItemArvore[];
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
    .map((d) => {
      const itens = organizarAreas(
        d.nome,
        as
          .filter((a) => a.disciplinaId === d.id)
          .map((a) => ({ id: a.id, nome: a.nome, total: totais.get(`${p}:a:${a.id}`) ?? 0 }))
          .filter((a) => a.total > 0),
      );
      return {
        id: d.id,
        nome: d.nome,
        total: totais.get(`${p}:d:${d.id}`) ?? 0,
        areas: itens.flatMap(areasDoItem),
        itens,
      };
    })
    .filter((d) => d.total > 0);
}
