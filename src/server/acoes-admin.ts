"use server";

// Ações da área do dono (/admin). Todas começam com exigirAdmin().
import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { criarGravador, lerArquivo, prepararItem, type ExtrasArquivo, type ItemPronto } from "@/db/importacao";
import { aprovarFlashcards, aprovarQuestoes, rejeitar, resolverReporte } from "@/db/aprovacao";
import { assuntos, disciplinas, flashcards, questoes } from "@/db/schema";
import { chaveNome, semelhanca } from "@/lib/catalogo";
import { avisosDoLote } from "@/lib/qualidade";
import type { Dificuldade } from "@/lib/dificuldade";
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
      /** Problemas de qualidade do lote (pena demais, correta sempre a mais longa). */
      avisos: string[];
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
    avisos: avisosDoLote(questoesNovas),
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

// ---------- Revisão das questões e flashcards gerados por IA (/admin/revisao) ----------
// A lógica fica em src/db/aprovacao.ts (a produção automática usa a mesma).

const idRevisao = z.number().int().positive();
const edicaoQuestao = z
  .object({
    enunciado: z.string().trim().min(1).max(20_000),
    alternativas: z.array(z.object({ letra: z.string().regex(/^[A-E]$/), texto: z.string().trim().min(1).max(5_000) })).min(2).max(5),
    gabarito: z.string().regex(/^[A-E]$/),
    comentario: z.string().trim().min(1).max(40_000),
  })
  .refine((e) => e.alternativas.some((a) => a.letra === e.gabarito), { message: "O gabarito precisa ser uma das alternativas." });
const edicaoFlashcard = z.object({ frente: z.string().trim().min(1).max(2_000), verso: z.string().trim().min(1).max(10_000) });
const motivoRejeicao = z.string().trim().min(3, "Escreva o motivo.").max(2_000);

export type ResultadoRevisao = { ok: true; aprovadas: number } | { ok: false; erro: string };

function revalidar() {
  revalidatePath("/admin/revisao");
}

export async function aprovarRevisao(id: number, edicao?: unknown): Promise<ResultadoRevisao> {
  const usuario = await exigirAdmin();
  const i = idRevisao.safeParse(id);
  if (!i.success) return { ok: false, erro: "Questão inválida." };
  const e = edicao === undefined ? undefined : edicaoQuestao.safeParse(edicao);
  if (e && !e.success) return { ok: false, erro: e.error.issues[0]!.message };
  const aprovadas = await aprovarQuestoes(db, [i.data], usuario.email, e?.data);
  revalidar();
  return aprovadas ? { ok: true, aprovadas } : { ok: false, erro: "Essa questão já foi revisada." };
}

/** Aprova de uma vez as questões indicadas (a tela manda só as da página que o auditor validou). */
export async function aprovarRevisaoEmLote(ids: unknown, tipo: "questao" | "flashcard" = "questao"): Promise<ResultadoRevisao> {
  const usuario = await exigirAdmin();
  const lista = z.array(idRevisao).min(1).max(50).safeParse(ids);
  if (!lista.success || !["questao", "flashcard"].includes(tipo)) return { ok: false, erro: "Seleção inválida." };
  const aprovadas = tipo === "questao" ? await aprovarQuestoes(db, lista.data, usuario.email) : await aprovarFlashcards(db, lista.data, usuario.email);
  revalidar();
  return { ok: true, aprovadas };
}

export async function rejeitarRevisao(id: number, motivo: string, tipo: "questao" | "flashcard" = "questao"): Promise<ResultadoRevisao> {
  const usuario = await exigirAdmin();
  const dados = z.object({ id: idRevisao, motivo: motivoRejeicao, tipo: z.enum(["questao", "flashcard"]) }).safeParse({ id, motivo, tipo });
  if (!dados.success) return { ok: false, erro: dados.error.issues[0]!.message };
  const ok = await rejeitar(db, dados.data.tipo, dados.data.id, usuario.email, dados.data.motivo);
  revalidar();
  return ok ? { ok: true, aprovadas: 0 } : { ok: false, erro: "Esse item já foi revisado." };
}

export async function aprovarFlashcardRevisao(id: number, edicao?: unknown): Promise<ResultadoRevisao> {
  const usuario = await exigirAdmin();
  const i = idRevisao.safeParse(id);
  if (!i.success) return { ok: false, erro: "Flashcard inválido." };
  const e = edicao === undefined ? undefined : edicaoFlashcard.safeParse(edicao);
  if (e && !e.success) return { ok: false, erro: e.error.issues[0]!.message };
  const aprovados = await aprovarFlashcards(db, [i.data], usuario.email, e?.data);
  revalidar();
  return aprovados ? { ok: true, aprovadas: aprovados } : { ok: false, erro: "Esse flashcard já foi revisado." };
}

/** Aba "Reportados": devolve ao ar (reporte improcedente) ou mantém fora. */
export async function resolverReporteAdmin(reporteId: number, decisao: "restaurado" | "removido"): Promise<ResultadoRevisao> {
  await exigirAdmin();
  const dados = z.object({ id: idRevisao, decisao: z.enum(["restaurado", "removido"]) }).safeParse({ id: reporteId, decisao });
  if (!dados.success) return { ok: false, erro: "Reporte inválido." };
  const ok = await resolverReporte(db, dados.data.id, dados.data.decisao);
  revalidar();
  return ok ? { ok: true, aprovadas: 0 } : { ok: false, erro: "Esse reporte já foi resolvido." };
}
