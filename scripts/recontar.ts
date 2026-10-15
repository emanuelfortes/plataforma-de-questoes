// Uso: npm run recontar
import "./_env";
import { db } from "../src/db";
import { contagens } from "../src/db/schema";
import { recontar } from "./lib/recontar";

const inicio = Date.now();
await recontar(db);
const linhas = await db.select().from(contagens);
const total = linhas.find((l) => l.chave === "q:total")?.total ?? 0;
console.log(
  `Contagens atualizadas em ${((Date.now() - inicio) / 1000).toFixed(1)}s. ` +
    `${total.toLocaleString("pt-BR")} questões, ${linhas.length} chaves.`,
);
