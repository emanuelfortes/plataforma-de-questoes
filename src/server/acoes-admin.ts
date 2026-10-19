"use server";

// Ações da área do dono (/admin). Todas começam com exigirAdmin().
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { criarGravador, lerArquivo, prepararItem, type ExtrasArquivo, type ItemPronto } from "@/db/importacao";
import { assuntos, disciplinas, flashcards, questoes, questoesRevisao } from "@/db/schema";
import { chaveNome, semelhanca } from "@/lib/catalogo";
import { dificuldadePorNivel, type Dificuldade } from "@/lib/dificuldade";
import { bancaInedita, montarComentario } from "@/lib/revisao";
import { exigirAdmin } from "@/lib/sessao";

// 5 MB: bem acima de um lote gerado por IA (cerca de 100 questões dão 100 KB).
const entrada = z.string().max(5_000_000, "Arquivo grande demais (máximo 5 MB). Divida em partes.");
const LOTE = 500;

type Invalido = { posicao: number; trecho: string; erro: string };

function analisar(texto: string) {
  const { itens, extras, erro } = lerArquivo(texto);
  const validos: ItemPronto[] = [];
  const invalidos: Invalido[] = [];
  itens.forEach((bruto, i) => {
    const r = prepararItem(bruto);
    if (r.ok) return validos.push(r.item);
    const b = (bruto ?? {}) as Record<string, unknown>;
    const trecho = String(b.enunciado ?? b.frente ?? "").slice(0, 90);
    invalidos.push({ posicao: i + 1, trecho, erro: r.erro });
  });
  return { validos, invalidos, extras, erroFormato: erro };
}

/** Códigos que já estão no banco (para avisar o que será ignorado). Lê só as linhas encontradas. */
async function codigosExistentes(itens: ItemPronto[]) {
  const existentes = new Set<string>();
  const porTipo = [
    { tabela: questoes, codigos: itens.filter((i) => i.tipo === "multipla").map((i) => i.codigo) },
    { tabela: flashcards, codigos: itens.filter((i) => i.tipo === "flashcard").map((i) => i.codigo) },
  ];
  for (const { tabela, codigos } of porTipo) {
    for (let i = 0; i < codigos.length; i += LOTE) {
      const linhas = await db
        .select({ codigo: tabela.codigo })
        .from(tabela)
        .where(inArray(tabela.codigo, codigos.slice(i, i + LOTE)));
      for (const l of linhas) existentes.add(l.codigo);
    }
  }
  return existentes;
}

/** Matérias e áreas que o arquivo vai criar, com a existente mais parecida (para o dono conferir). */
async function novidades(itens: ItemPronto[]) {
  const [ds, as] = await Promise.all([db.select().from(disciplinas), db.select().from(assuntos)]);
  const materiaPorChave = new Map(ds.map((d) => [chaveNome(d.nome), d]));
  const parecida = (nome: string, candidatos: string[]) =>
    candidatos
      .map((c) => ({ c, n: semelhanca(nome, c) }))
      .filter((x) => x.n >= 0.6)
      .sort((x, y) => y.n - x.n)[0]?.c;

  const materias = new Map<string, { nome: string; parecida?: string }>();
  const areas = new Map<string, { materia: string; nome: string; parecida?: string }>();
  for (const item of itens) {
    const existente = materiaPorChave.get(chaveNome(item.disciplina));
    if (!existente && !materias.has(item.disciplina)) {
      materias.set(item.disciplina, { nome: item.disciplina, parecida: parecida(item.disciplina, ds.map((d) => d.nome)) });
    }
    if (!item.assunto) continue;
    const daMateria = existente ? as.filter((x) => x.disciplinaId === existente.id).map((x) => x.nome) : [];
    const chave = `${item.disciplina}::${chaveNome(item.assunto)}`;
    if (daMateria.some((n) => chaveNome(n) === chaveNome(item.assunto!)) || areas.has(chave)) continue;
    areas.set(chave, { materia: item.disciplina, nome: item.assunto, parecida: parecida(item.assunto, daMateria) });
  }
  return { materias: [...materias.values()], areas: [...areas.values()] };
}

export type LinhaResumo = { area: string } & Record<Dificuldade | "semNivel" | "flashcards", number>;

export type ResultadoConferencia =
  | { ok: false; erro: string }
  | {
      ok: true;
      disciplinas: string[];
      totais: { questoes: number; flashcards: number; jaExistem: number; invalidos: number };
      porArea: LinhaResumo[];
      invalidos: Invalido[];
      extras: ExtrasArquivo;
      novas: Awaited<ReturnType<typeof novidades>>;
      amostra: {
        area: string | undefined;
        dificuldade: Dificuldade | undefined;
        enunciado: string;
        alternativas: { letra: string; texto: string }[];
        gabarito: string;
        comentario: string | undefined;
      }[];
    };

/** Lê o arquivo e mostra o que seria importado. Não grava nada. */
export async function conferirConteudo(texto: string): Promise<ResultadoConferencia> {
  await exigirAdmin();
  const valido = entrada.safeParse(texto);
  if (!valido.success) return { ok: false, erro: valido.error.issues[0]!.message };

  const { validos, invalidos, extras, erroFormato } = analisar(valido.data);
  if (erroFormato) return { ok: false, erro: erroFormato };

  const existentes = await codigosExistentes(validos);
  const novos = validos.filter((i) => !existentes.has(i.codigo));

  const linhas = new Map<string, LinhaResumo>();
  for (const item of novos) {
    const area = `${item.disciplina} · ${item.assunto ?? "(sem área)"}`;
    const l = linhas.get(area) ?? { area, facil: 0, medio: 0, dificil: 0, semNivel: 0, flashcards: 0 };
    if (item.tipo === "flashcard") l.flashcards++;
    else l[item.dificuldade ?? "semNivel"]++;
    linhas.set(area, l);
  }

  const questoesNovas = novos.filter((i) => i.tipo === "multipla");
  return {
    ok: true,
    disciplinas: [...new Set(validos.map((i) => i.disciplina))],
    totais: {
      questoes: questoesNovas.length,
      flashcards: novos.length - questoesNovas.length,
      jaExistem: validos.length - novos.length,
      invalidos: invalidos.length,
    },
    porArea: [...linhas.values()].sort((a, b) => a.area.localeCompare(b.area, "pt-BR")),
    invalidos: invalidos.slice(0, 100),
    extras,
    novas: await novidades(novos),
    amostra: questoesNovas.slice(0, 3).map((q) => ({
      area: q.assunto,
      dificuldade: q.dificuldade,
      enunciado: q.enunciado,
      alternativas: q.alternativas,
      gabarito: q.gabarito,
      comentario: q.comentario,
    })),
  };
}

export type ResultadoImportacao =
  | { ok: false; erro: string }
  | { ok: true; questoes: number; flashcards: number; jaExistiam: number; invalidos: number };

/** Grava os itens válidos do arquivo. Itens inválidos ou repetidos são ignorados. */
export async function importarConteudo(texto: string): Promise<ResultadoImportacao> {
  await exigirAdmin();
  const valido = entrada.safeParse(texto);
  if (!valido.success) return { ok: false, erro: valido.error.issues[0]!.message };

  const { validos, invalidos, erroFormato } = analisar(valido.data);
  if (erroFormato) return { ok: false, erro: erroFormato };
  if (!validos.length) return { ok: false, erro: "Nenhum item válido para importar." };

  const gravador = criarGravador(db);
  let novasQuestoes = 0;
  let novosFlashcards = 0;
  const qs = validos.filter((i) => i.tipo === "multipla");
  const fs = validos.filter((i) => i.tipo === "flashcard");
  for (let i = 0; i < qs.length; i += LOTE) novasQuestoes += await gravador.gravarQuestoes(qs.slice(i, i + LOTE));
  for (let i = 0; i < fs.length; i += LOTE) novosFlashcards += await gravador.gravarFlashcards(fs.slice(i, i + LOTE));

  return {
    ok: true,
    questoes: novasQuestoes,
    flashcards: novosFlashcards,
    jaExistiam: validos.length - novasQuestoes - novosFlashcards,
    invalidos: invalidos.length,
  };
}

// ---------- Revisão das questões geradas por IA (/admin/revisao) ----------

const idRevisao = z.number().int().positive();
const edicaoRevisao = z
  .object({
    enunciado: z.string().trim().min(1).max(20_000),
    alternativas: z.array(z.object({ letra: z.string().regex(/^[A-E]$/), texto: z.string().trim().min(1).max(5_000) })).min(2).max(5),
    gabarito: z.string().regex(/^[A-E]$/),
    comentario: z.string().trim().min(1).max(40_000),
  })
  .refine((e) => e.alternativas.some((a) => a.letra === e.gabarito), { message: "O gabarito precisa ser uma das alternativas." });

export type ResultadoRevisao = { ok: true; aprovadas: number } | { ok: false; erro: string };

/** Copia questões revisadas para "questoes" (com contagens) e marca como aprovadas. Idempotente. */
async function aprovar(ids: number[], email: string, edicao?: z.infer<typeof edicaoRevisao>) {
  const linhas = await db
    .select()
    .from(questoesRevisao)
    .where(and(inArray(questoesRevisao.id, ids), eq(questoesRevisao.status, "pendente_revisao")));
  if (!linhas.length) return 0;
  const prontas = linhas.map((r) => {
    const comentario = edicao?.comentario ?? montarComentario(r);
    return {
      tipo: "multipla" as const,
      codigo: r.codigo,
      disciplina: r.disciplina,
      assunto: r.assunto,
      dificuldade: dificuldadePorNivel(r.dificuldade) ?? undefined,
      banca: bancaInedita(r.banca),
      enunciado: edicao?.enunciado ?? r.enunciado,
      alternativas: edicao?.alternativas ?? r.alternativas,
      gabarito: edicao?.gabarito ?? r.gabarito,
      comentario,
      // Ligação com a revisão (o código já é o mesmo): filtrar as de IA e revisar quando uma lei mudar.
      origem: r.origem,
      topicoTaxonomia: r.topicoTaxonomia,
      subtopico: r.subtopico,
      leiReferencia: r.leiReferencia,
    };
  });
  // Grava primeiro em "questoes" (ignora código repetido) e só depois marca como aprovada:
  // se cair no meio, aprovar de novo não duplica.
  await criarGravador(db).gravarQuestoes(prontas);
  const agora = new Date();
  for (const p of prontas) {
    await db
      .update(questoesRevisao)
      .set({
        status: "aprovada",
        revisadoEm: agora,
        revisadoPor: email,
        comentarioFinal: p.comentario,
        ...(edicao ? { enunciado: p.enunciado, alternativas: p.alternativas, gabarito: p.gabarito, motivoRevisao: "editada antes de aprovar" } : {}),
      })
      .where(eq(questoesRevisao.codigo, p.codigo));
  }
  return prontas.length;
}

export async function aprovarRevisao(id: number, edicao?: unknown): Promise<ResultadoRevisao> {
  const usuario = await exigirAdmin();
  const i = idRevisao.safeParse(id);
  if (!i.success) return { ok: false, erro: "Questão inválida." };
  let dados: z.infer<typeof edicaoRevisao> | undefined;
  if (edicao !== undefined) {
    const e = edicaoRevisao.safeParse(edicao);
    if (!e.success) return { ok: false, erro: e.error.issues[0]!.message };
    dados = e.data;
  }
  const aprovadas = await aprovar([i.data], usuario.email, dados);
  revalidatePath("/admin/revisao");
  return aprovadas ? { ok: true, aprovadas } : { ok: false, erro: "Essa questão já foi revisada." };
}

/** Aprova de uma vez as questões indicadas (a tela manda só as da página que o auditor validou). */
export async function aprovarRevisaoEmLote(ids: unknown): Promise<ResultadoRevisao> {
  const usuario = await exigirAdmin();
  const lista = z.array(idRevisao).min(1).max(50).safeParse(ids);
  if (!lista.success) return { ok: false, erro: "Seleção inválida." };
  const aprovadas = await aprovar(lista.data, usuario.email);
  revalidatePath("/admin/revisao");
  return { ok: true, aprovadas };
}

export async function rejeitarRevisao(id: number, motivo: string): Promise<ResultadoRevisao> {
  const usuario = await exigirAdmin();
  const dados = z.object({ id: idRevisao, motivo: z.string().trim().min(3, "Escreva o motivo.").max(2_000) }).safeParse({ id, motivo });
  if (!dados.success) return { ok: false, erro: dados.error.issues[0]!.message };
  const r = await db
    .update(questoesRevisao)
    .set({ status: "rejeitada", revisadoEm: new Date(), revisadoPor: usuario.email, motivoRevisao: dados.data.motivo })
    .where(and(eq(questoesRevisao.id, dados.data.id), eq(questoesRevisao.status, "pendente_revisao")));
  revalidatePath("/admin/revisao");
  return r.rowsAffected ? { ok: true, aprovadas: 0 } : { ok: false, erro: "Essa questão já foi revisada." };
}
