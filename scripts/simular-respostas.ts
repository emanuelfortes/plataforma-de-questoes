// Cria respostas falsas nos últimos 30 dias para um aluno, para testar a tela de desempenho.
// Uso: npm run simular -- email@do-aluno.com [quantidade]
// Só para desenvolvimento. Não rode em produção.
import "./_env";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { questoes, respostas, statusQuestao, user } from "../src/db/schema";

const [email, qtdTexto] = process.argv.slice(2);
if (!email) {
  console.error("Informe o e-mail do aluno: npm run simular -- voce@email.com 300");
  process.exit(1);
}
const QUANTIDADE = Number(qtdTexto ?? 300);

const [aluno] = await db.select().from(user).where(eq(user.email, email));
if (!aluno) {
  console.error(`Nenhum usuário com e-mail ${email}. Cadastre-se no app primeiro.`);
  process.exit(1);
}

const amostra = await db
  .select({ id: questoes.id, gabarito: questoes.gabarito, alternativas: questoes.alternativas })
  .from(questoes)
  .orderBy(sql`random()`)
  .limit(QUANTIDADE);

const agora = Date.now();
for (const q of amostra) {
  // Mais respostas nos dias recentes e taxa de acerto de ~65%.
  const diasAtras = Math.floor(Math.pow(Math.random(), 1.6) * 30);
  const quando = new Date(agora - diasAtras * 86_400_000 - Math.random() * 36_000_000);
  const acertou = Math.random() < 0.65;
  const errada = q.alternativas.find((a) => a.letra !== q.gabarito)?.letra ?? q.gabarito;
  const alternativa = acertou ? q.gabarito : errada;

  await db.batch([
    db.insert(respostas).values({
      usuarioId: aluno.id,
      questaoId: q.id,
      alternativa,
      correta: acertou,
      respondidaEm: quando,
    }),
    db
      .insert(statusQuestao)
      .values({ usuarioId: aluno.id, questaoId: q.id, ultimaCorreta: acertou, atualizadaEm: quando })
      .onConflictDoUpdate({
        target: [statusQuestao.usuarioId, statusQuestao.questaoId],
        set: { ultimaCorreta: acertou, tentativas: sql`${statusQuestao.tentativas} + 1`, atualizadaEm: quando },
      }),
  ]);
}

console.log(`${amostra.length} respostas simuladas para ${email}.`);
