// Núcleo da importação de conteúdo, usado pelo script (scripts/importar.ts) e pela tela do dono
// (/admin). Sem "server-only" porque o script roda fora do Next; só importe em código de servidor.
//
// Aceita o que as IAs costumam devolver: o JSON do prompt ({ disciplina, questoes, flashcards }),
// um array de itens, ou JSON Lines (um objeto por linha), com ou sem cercas ```json.
import { createHash, randomInt } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Db } from "./index";
import { assuntos, contagens, disciplinas, flashcards, questoes } from "./schema";
import { chaveNome, nomesPreferidos, normalizar } from "../lib/catalogo";
import { NIVEL_DIFICULDADE } from "../lib/dificuldade";
import { esquemaFlashcard, esquemaQuestao, type LinhaFlashcard, type LinhaQuestao } from "../lib/formato-jsonl";

export type QuestaoPronta = LinhaQuestao & { codigo: string };
export type FlashcardPronto = LinhaFlashcard & { codigo: string };
export type ItemPronto = QuestaoPronta | FlashcardPronto;

/** Informações extras que o prompt pede (só exibidas na conferência, não gravadas). */
export type ExtrasArquivo = {
  pontosCobertos: { area: string; ponto: string; questoes?: number }[];
  areasSugeridas: string[];
};

type Objeto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);

/** Separa o texto do arquivo em itens brutos. Não valida os itens (isso é prepararItem). */
export function lerArquivo(texto: string): { itens: unknown[]; extras: ExtrasArquivo; erro?: string } {
  const extras: ExtrasArquivo = { pontosCobertos: [], areasSugeridas: [] };
  // Tira as cercas de código que a IA às vezes deixa (```json ... ```) e o BOM do Windows.
  const limpo = texto.replace(/^﻿/, "").replace(/^\s*```[a-z]*\s*$/gim, "").trim();
  if (!limpo) return { itens: [], extras, erro: "O arquivo está vazio." };

  let inteiro: unknown;
  try {
    inteiro = JSON.parse(limpo);
  } catch {
    inteiro = undefined;
  }

  if (Array.isArray(inteiro)) return { itens: inteiro, extras };

  if (ehObjeto(inteiro)) {
    const disciplina = typeof inteiro.disciplina === "string" ? inteiro.disciplina : undefined;
    const comMateria = (lista: unknown, tipo: "multipla" | "flashcard") =>
      (Array.isArray(lista) ? lista : []).map((i) => (ehObjeto(i) ? { tipo, disciplina, ...i } : i));
    if (Array.isArray(inteiro.pontos_cobertos)) {
      extras.pontosCobertos = inteiro.pontos_cobertos.filter(ehObjeto).map((p) => ({
        area: String(p.area ?? ""),
        ponto: String(p.ponto ?? ""),
        questoes: typeof p.questoes === "number" ? p.questoes : undefined,
      }));
    }
    if (Array.isArray(inteiro.areas_sugeridas)) extras.areasSugeridas = inteiro.areas_sugeridas.map(String);
    const itens = [...comMateria(inteiro.questoes, "multipla"), ...comMateria(inteiro.flashcards, "flashcard")];
    if (!itens.length && "tipo" in inteiro) return { itens: [inteiro], extras }; // JSONL de uma linha só
    if (!itens.length) return { itens, extras, erro: 'Não encontrei questões nem flashcards no arquivo (listas "questoes" e "flashcards").' };
    return { itens, extras };
  }

  // JSON Lines: um objeto por linha.
  const itens: unknown[] = [];
  for (const [i, linha] of limpo.split(/\r?\n/).entries()) {
    const t = linha.trim().replace(/,$/, "");
    if (!t) continue;
    try {
      itens.push(JSON.parse(t));
    } catch {
      return {
        itens: [],
        extras,
        erro: `O arquivo não é um JSON válido (problema perto da linha ${i + 1}). Peça para a IA gerar de novo no formato pedido.`,
      };
    }
  }
  return { itens, extras };
}

/** Código estável derivado do conteúdo: a mesma questão vinda de outro arquivo não duplica. */
function impressaoDigital(prefixo: string, partes: string[]) {
  const hash = createHash("sha256").update(partes.map(normalizar).join("\u0000")).digest("hex");
  return `${prefixo}${hash.slice(0, 24)}`;
}

/** Ajusta pequenos desvios comuns das IAs antes de validar ("area" no lugar de "assunto", letra minúscula...). */
function ajustar(bruto: Objeto): Objeto {
  const item: Objeto = { ...bruto };
  if (item.assunto === undefined && item.area !== undefined) item.assunto = item.area;
  delete item.area;
  if (item.tipo === undefined) item.tipo = "frente" in item ? "flashcard" : "multipla";
  if (typeof item.gabarito === "string") item.gabarito = item.gabarito.trim().toUpperCase();
  if (typeof item.dificuldade === "string") item.dificuldade = normalizar(item.dificuldade);
  if (Array.isArray(item.alternativas)) {
    item.alternativas = item.alternativas.map((a) =>
      ehObjeto(a) && typeof a.letra === "string" ? { ...a, letra: a.letra.trim().toUpperCase() } : a,
    );
  }
  for (const campo of ["assunto", "banca", "comentario"]) if (item[campo] === "" || item[campo] === null) delete item[campo];
  return item;
}

/** Valida um item e devolve pronto para gravar (nomes padronizados e código), ou o motivo da recusa. */
export function prepararItem(bruto: unknown): { ok: true; item: ItemPronto } | { ok: false; erro: string } {
  if (!ehObjeto(bruto)) return { ok: false, erro: "não é um objeto JSON" };
  const ajustado = ajustar(bruto);
  if (ajustado.tipo !== "multipla" && ajustado.tipo !== "flashcard") {
    return { ok: false, erro: 'tipo: deve ser "multipla" ou "flashcard"' };
  }
  // Valida pelo esquema do tipo: o erro aponta o campo exato.
  const r = (ajustado.tipo === "multipla" ? esquemaQuestao : esquemaFlashcard).safeParse(ajustado);
  if (!r.success) {
    return { ok: false, erro: r.error.issues.map((i) => `${i.path.join(".") || "(item)"}: ${i.message}`).join("; ") };
  }
  // Matéria e área podem ser novas (a IA as tira do PDF); só o nome é padronizado.
  const nomes = nomesPreferidos(r.data.disciplina, r.data.assunto);
  const item = { ...r.data, disciplina: nomes.disciplina, assunto: nomes.assunto };

  if (item.tipo === "multipla") {
    const codigo =
      item.id ?? impressaoDigital("h_", [item.disciplina, item.enunciado, ...item.alternativas.map((a) => a.texto)]);
    return { ok: true, item: { ...item, codigo } };
  }
  return { ok: true, item: { ...item, codigo: item.id ?? impressaoDigital("hf_", [item.disciplina, item.frente]) } };
}

/**
 * Grava lotes no banco. Reaproveite a mesma instância durante uma importação (guarda os ids de
 * matérias e áreas). Atualiza "contagens" somando só o que entrou, sem recontar a tabela.
 */
export function criarGravador(db: Db) {
  // Matérias e áreas já cadastradas, por chaveNome(): um nome equivalente reaproveita a existente.
  // As duas tabelas são pequenas (centenas de linhas): carregadas uma vez por importação.
  let carregado = false;
  const idsDisciplina = new Map<string, number>(); // chaveNome(matéria)
  const idsAssunto = new Map<string, number>(); // `${disciplinaId}::${chaveNome(área)}`

  async function carregar() {
    if (carregado) return;
    for (const d of await db.select().from(disciplinas)) idsDisciplina.set(chaveNome(d.nome), d.id);
    for (const a of await db.select().from(assuntos)) idsAssunto.set(`${a.disciplinaId}::${chaveNome(a.nome)}`, a.id);
    carregado = true;
  }

  async function idDisciplina(nome: string) {
    await carregar();
    const chave = chaveNome(nome);
    const existente = idsDisciplina.get(chave);
    if (existente) return existente;
    await db.insert(disciplinas).values({ nome }).onConflictDoNothing();
    const [d] = await db.select().from(disciplinas).where(eq(disciplinas.nome, nome));
    idsDisciplina.set(chave, d!.id);
    return d!.id;
  }

  async function idAssunto(disciplinaId: number, nome: string | undefined) {
    if (!nome) return null;
    await carregar();
    const chave = `${disciplinaId}::${chaveNome(nome)}`;
    const existente = idsAssunto.get(chave);
    if (existente) return existente;
    const [a] = await db
      .insert(assuntos)
      .values({ disciplinaId, nome })
      .onConflictDoUpdate({ target: [assuntos.disciplinaId, assuntos.nome], set: { nome } })
      .returning({ id: assuntos.id });
    idsAssunto.set(chave, a!.id);
    return a!.id;
  }

  async function somarContagens(prefixo: "q" | "f", linhas: { disciplinaId: number; assuntoId: number | null }[]) {
    if (!linhas.length) return;
    const somas = new Map<string, number>([[`${prefixo}:total`, linhas.length]]);
    const somar = (chave: string) => somas.set(chave, (somas.get(chave) ?? 0) + 1);
    for (const l of linhas) {
      somar(`${prefixo}:d:${l.disciplinaId}`);
      if (l.assuntoId) somar(`${prefixo}:a:${l.assuntoId}`);
    }
    await db
      .insert(contagens)
      .values([...somas].map(([chave, total]) => ({ chave, total })))
      .onConflictDoUpdate({ target: contagens.chave, set: { total: sql`${contagens.total} + excluded.total` } });
  }

  /** Devolve quantas entraram (as demais já existiam). */
  async function gravarQuestoes(lista: QuestaoPronta[]) {
    if (!lista.length) return 0;
    const valores = [];
    for (const q of lista) {
      const disciplinaId = await idDisciplina(q.disciplina);
      valores.push({
        codigo: q.codigo,
        disciplinaId,
        assuntoId: await idAssunto(disciplinaId, q.assunto),
        banca: q.banca ?? null,
        ano: q.ano ?? null,
        enunciado: q.enunciado,
        alternativas: q.alternativas,
        gabarito: q.gabarito,
        comentario: q.comentario ?? null,
        dificuldade: q.dificuldade ? NIVEL_DIFICULDADE[q.dificuldade] : null,
        // Posição sorteada: mistura níveis e áreas na listagem (o arquivo costuma vir agrupado).
        ordem: randomInt(2 ** 31),
      });
    }
    const inseridas = await db
      .insert(questoes)
      .values(valores)
      .onConflictDoNothing({ target: questoes.codigo })
      .returning({ disciplinaId: questoes.disciplinaId, assuntoId: questoes.assuntoId });
    await somarContagens("q", inseridas);
    return inseridas.length;
  }

  async function gravarFlashcards(lista: FlashcardPronto[]) {
    if (!lista.length) return 0;
    const valores = [];
    for (const f of lista) {
      const disciplinaId = await idDisciplina(f.disciplina);
      valores.push({
        codigo: f.codigo,
        disciplinaId,
        assuntoId: await idAssunto(disciplinaId, f.assunto),
        frente: f.frente,
        verso: f.verso,
      });
    }
    const inseridos = await db
      .insert(flashcards)
      .values(valores)
      .onConflictDoNothing({ target: flashcards.codigo })
      .returning({ disciplinaId: flashcards.disciplinaId, assuntoId: flashcards.assuntoId });
    await somarContagens("f", inseridos);
    return inseridos.length;
  }

  return { gravarQuestoes, gravarFlashcards };
}
