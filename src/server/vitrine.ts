import "server-only";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { contagens, disciplinas } from "@/db/schema";

/** Números da página de vendas. Tudo sai de "contagens" e da lista de matérias (tabela pequena). */
export async function resumoVitrine() {
  const [totais, materias] = await Promise.all([
    db.select({ chave: contagens.chave, total: contagens.total }).from(contagens).where(inArray(contagens.chave, ["q:total", "f:total"])),
    db.select({ nome: disciplinas.nome }).from(disciplinas).orderBy(asc(disciplinas.nome)),
  ]);
  const total = (chave: string) => totais.find((t) => t.chave === chave)?.total ?? 0;
  return { questoes: total("q:total"), flashcards: total("f:total"), materias: materias.map((m) => m.nome) };
}
