// Envia as três versões do aviso de simulado liberado (Tropa de Elite, assinante do Basic e sem plano) SÓ para o
// e-mail indicado, para conferir o texto e o visual antes de ligar o envio para todos. Não grava nada no banco.
//
//   npx tsx --conditions=react-server scripts/simulados/testar-aviso.ts --para voce@email.com [--id 1]
import "../_env";
import { createClient } from "@libsql/client";
import { formatarReais, precoDoPlano } from "../../src/lib/planos";
import { emailSimuladoLiberado, enviarEmail, servicoDeEmail, type PublicoAviso } from "../../src/server/email";

const args = process.argv.slice(2);
const valor = (nome: string) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
};
const para = valor("--para");
if (!para) {
  console.log("Uso: --para voce@email.com [--id 1]");
  process.exit(1);
}
// Links do e-mail sempre para o site no ar, mesmo com o .env.local em localhost.
process.env.BETTER_AUTH_URL = "https://riccardonobrega.com";
console.log(`Serviço de e-mail: ${servicoDeEmail() ?? "nenhum (só imprime no terminal)"}`);

const banco = createClient({ url: process.env.TURSO_DATABASE_URL || "file:local.db", authToken: process.env.TURSO_AUTH_TOKEN || undefined });
const id = Number(valor("--id") ?? 0);
const { rows } = await banco.execute({
  sql: id
    ? "select id, titulo, concurso, duracao_min, json_array_length(gabarito) q, encerra_em from simulados where id = ?"
    : "select id, titulo, concurso, duracao_min, json_array_length(gabarito) q, encerra_em from simulados order by liberado_em desc limit 1",
  args: id ? [id] : [],
});
const s = rows[0];
if (!s) {
  console.log("Nenhum simulado encontrado.");
  process.exit(1);
}
const min = Number(s.duracao_min);
const tempo = min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`;
const encerra = s.encerra_em ? new Date(Number(s.encerra_em) * 1000) : null;
const base = {
  titulo: String(s.titulo),
  concurso: String(s.concurso),
  questoes: Number(s.q),
  tempo,
  prazo: encerra ? `até ${encerra.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}` : "",
  precoElite: formatarReais(precoDoPlano("elite")),
};
for (const publico of ["elite", "basico", "sem-plano"] as PublicoAviso[]) {
  const url = publico === "elite" ? `https://riccardonobrega.com/simulados/${s.id}` : "https://riccardonobrega.com/assinatura";
  const email = emailSimuladoLiberado("Teste", publico, { ...base, url });
  const ok = await enviarEmail({ para, ...email, assunto: `[TESTE ${publico}] ${email.assunto}` });
  console.log(`${publico}: ${ok ? "enviado" : "falhou (veja o erro acima)"}`);
}
