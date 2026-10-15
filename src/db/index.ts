import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Reaproveita o cliente entre recargas do `next dev` para não abrir conexões demais.
const globalParaDb = globalThis as unknown as { clienteLibsql?: Client };

const cliente =
  globalParaDb.clienteLibsql ??
  createClient({
    url: process.env.TURSO_DATABASE_URL || "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

if (process.env.NODE_ENV !== "production") globalParaDb.clienteLibsql = cliente;

export const db = drizzle(cliente, { schema });
export type Db = typeof db;
