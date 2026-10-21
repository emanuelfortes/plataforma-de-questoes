// Sinais de qualidade de um lote de questões (usados pela geração automática e pelo importador do /admin).

/**
 * Alternativa que fala de quantidade de pena ("reclusão de 2 a 4 anos", "aumentada de um terço", "em dobro").
 * Questão que cobra pena é exceção: ninguém decora pena, e a banca cobra mais o crime, os elementos e as exceções.
 */
export const PADRAO_PENA =
  /\b(reclus[ãa]o|deten[çc][ãa]o)\b|\bpena (de|aumentad|reduzid|diminu)|aumentada (de|at[ée]|em)|em dobro|\bde (um|dois|tr[êe]s|quatro|seis|1|2|3|4|6) (a|meses)|um ter[çc]o|dois ter[çc]os|metade/i;

/** A questão gira em torno de pena: 2 ou mais alternativas falam de quantidade de pena. */
export const cobraPena = (q: { alternativas: { texto: string }[] }) => q.alternativas.filter((a) => PADRAO_PENA.test(a.texto)).length >= 2;

/** Proporção máxima aceitável de questões sobre pena num lote. */
export const LIMITE_PENA_NO_LOTE = 0.1;

/** A correta é a alternativa mais longa (pista de tamanho). */
export function corretaMaisLonga(q: { alternativas: { letra: string; texto: string }[]; gabarito: string }) {
  const c = q.alternativas.find((a) => a.letra === q.gabarito)?.texto.length ?? 0;
  return q.alternativas.filter((a) => a.letra !== q.gabarito).every((a) => a.texto.length < c);
}

/** Avisos sobre o lote, para o dono decidir antes de importar. */
export function avisosDoLote(questoes: { disciplina: string; alternativas: { letra: string; texto: string }[]; gabarito: string }[]) {
  const avisos: string[] = [];
  const penais = questoes.filter((q) => /Penal/i.test(q.disciplina) && !/Processual/i.test(q.disciplina));
  const pena = penais.filter(cobraPena).length;
  if (penais.length >= 10 && pena / penais.length > LIMITE_PENA_NO_LOTE)
    avisos.push(
      `${pena} de ${penais.length} questões penais (${Math.round((100 * pena) / penais.length)}%) giram em torno de quantidade de pena. O ideal é até ${Math.round(LIMITE_PENA_NO_LOTE * 100)}%: peça à IA para cobrar o crime em vez da pena.`,
    );
  // Certo ou errado: com o gabarito quase todo igual, o aluno acerta chutando sempre o mesmo.
  const ce = questoes.filter((q) => q.alternativas.length === 2 && q.alternativas.some((a) => /^certo$/i.test(a.texto.trim())));
  const certos = ce.filter((q) => /^certo$/i.test(q.alternativas.find((a) => a.letra === q.gabarito)?.texto.trim() ?? "")).length;
  if (ce.length >= 10 && (certos / ce.length < 0.35 || certos / ce.length > 0.65))
    avisos.push(
      `Das ${ce.length} questões de certo ou errado, ${certos} têm gabarito "Certo" (${Math.round((100 * certos) / ce.length)}%). O ideal é perto de metade: peça à IA para equilibrar.`,
    );
  // Letra do gabarito concentrada (já aconteceu: "E" em 45% das questões de 5 alternativas).
  for (const n of [4, 5]) {
    const grupo = questoes.filter((q) => q.alternativas.length === n);
    if (grupo.length < 15) continue;
    const vezes = new Map<string, number>();
    for (const q of grupo) vezes.set(q.gabarito, (vezes.get(q.gabarito) ?? 0) + 1);
    const [letra, total] = [...vezes].sort((a, b) => b[1] - a[1])[0]!;
    if (total / grupo.length > 1.6 / n)
      avisos.push(
        `Nas ${grupo.length} questões de ${n} alternativas, o gabarito é "${letra}" em ${Math.round((100 * total) / grupo.length)}% (o normal é perto de ${Math.round(100 / n)}%). O aluno acerta chutando essa letra: peça à IA para variar a letra correta.`,
      );
  }
  const multiplas = questoes.filter((q) => q.alternativas.length >= 4);
  const longas = multiplas.filter(corretaMaisLonga).length;
  if (multiplas.length >= 10 && longas / multiplas.length > 0.35)
    avisos.push(
      `Em ${Math.round((100 * longas) / multiplas.length)}% das questões a correta é a alternativa mais longa (o normal é perto de 20% a 25%). O aluno acerta pelo tamanho: peça à IA para igualar o tamanho das alternativas.`,
    );
  return avisos;
}
