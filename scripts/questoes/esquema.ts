// Formato das questões geradas e das auditorias (base: Modo Plataforma do prompt-mestre).
// Usado pelo piloto com subagentes e pelos scripts da API. Mudou aqui? Atualize prompts/gerador.md
// e prompts/auditor.md se o significado de algum campo mudar.
import { z } from "zod";

const texto = z.string().trim().min(1);

export const STATUS_GERADOR = ["VALIDADA", "VALIDADA_COM_RESSALVA", "NECESSITA_DE_CONFERENCIA"] as const;
export const STATUS_AUDITORIA = ["VALIDADA", "VALIDADA_COM_RESSALVA", "NECESSITA_DE_CONFERENCIA", "REPROVADA"] as const;
export const TIPOS_COBRANCA = [
  "lei_seca",
  "conceito",
  "jurisprudencia",
  "caso_concreto",
  "comparacao",
  "excecao",
  "aplicacao_pratica",
  "interpretacao",
] as const;
export const EXIGENCIAS = ["memorizacao", "compreensao", "aplicacao", "analise"] as const;
export const DIFICULDADES_GERADAS = ["facil", "media", "dificil"] as const;

export const esquemaQuestaoGerada = z.object({
  id: texto.describe("Identificador da questão no lote, ex.: q01"),
  tema: texto,
  subtema: texto,
  dificuldade: z.enum(DIFICULDADES_GERADAS),
  enunciado: texto,
  alternativas: z.array(z.object({ id: texto, texto })).min(2).max(5),
  id_correta: texto,
  comentario_geral: texto,
  analise_alternativas: z.array(z.object({ id: texto, correta: z.boolean(), justificativa: texto })),
  fundamento_legal: texto,
  fundamento_jurisprudencial: texto,
  observacao_temporal: texto,
  pegadinha: texto,
  lei_referencia: texto,
  macete_do_riccardo: z.string().nullable(),
  fique_ligado: z.string().nullable(),
  cuidado_na_prova: z.string().nullable(),
  tipo_cobranca: z.enum(TIPOS_COBRANCA),
  exigencia_cognitiva: z.enum(EXIGENCIAS),
  palavras_chave: z.array(texto),
  cita_jurisprudencia: z.boolean(),
  status_gerador: z.enum(STATUS_GERADOR),
  ressalvas: z.string().nullable(),
  fontes_consultadas: z.array(texto),
});

export const esquemaLoteGerado = z.object({
  questoes: z.array(esquemaQuestaoGerada),
  observacoes_do_lote: z.string().nullable(),
});

export const esquemaAuditoria = z.object({
  id: texto.describe("id da questão auditada"),
  status: z.enum(STATUS_AUDITORIA),
  gabarito_confere: z.boolean(),
  id_correta_segundo_auditor: z.string().nullable(),
  mais_de_uma_correta: z.boolean(),
  ambiguidade: z.boolean(),
  fundamento_confere: z.boolean(),
  problemas: z.array(
    z.object({
      tipo: z.enum(["normativo", "jurisprudencial", "alternativas", "gramatical", "pedagogico", "originalidade", "conjunto"]),
      gravidade: z.enum(["alta", "media", "baixa"]),
      descricao: texto,
    }),
  ),
  correcao_sugerida: z.string().nullable(),
  justificativa: texto.describe("Resumo do veredito, em 1 a 4 frases"),
});

export const esquemaLoteAuditado = z.object({ auditorias: z.array(esquemaAuditoria) });

export type QuestaoGerada = z.infer<typeof esquemaQuestaoGerada>;
export type LoteGerado = z.infer<typeof esquemaLoteGerado>;
export type Auditoria = z.infer<typeof esquemaAuditoria>;
export type LoteAuditado = z.infer<typeof esquemaLoteAuditado>;

// Pista pelo tamanho, nos dois sentidos: a correta não pode se destacar nem por ser a mais longa
// nem por ser a mais curta.
export const LIMITE_TAMANHO = 1.25; // correta até 25% mais longa que a média das erradas
export const LIMITE_TAMANHO_MINIMO = 0.8; // e no mínimo 80% da média das erradas
export const MAX_POR_LOTE_MAIS_LONGA = 3; // num lote de 10, correta mais longa em no máximo 3
export const MAX_POR_LOTE_MAIS_CURTA = 3; // e mais curta em no máximo 3
export const MAX_POR_LOTE_ABSOLUTO_SO_NAS_ERRADAS = 2; // questões com termo absoluto só nas erradas

/**
 * Termos absolutos que denunciam o distrator quando só as erradas os usam ("sempre", "jamais"...).
 * A correta pode tê-los quando a lei usa; a pista é a assimetria sistemática.
 */
export const PADRAO_ABSOLUTO =
  /\b(sempre|nunca|jamais|absolutamente|em qualquer (hip[óo]tese|caso|circunst[âa]ncia|situa[çc][ãa]o)|em nenhuma hip[óo]tese|tod[oa] e qualquer|automaticamente|necessariamente|sem (qualquer )?exce[çc][ãa]o|incondicionalmente|independentemente de qualquer)\b/i;

/**
 * Alternativa que fala de quantidade de pena ("reclusão de 2 a 4 anos", "aumentada de um terço", "em dobro").
 * Questão que cobra pena é exceção: ninguém decora pena, e a banca cobra mais o crime, os elementos e as exceções.
 */
export const PADRAO_PENA =
  /\b(reclus[ãa]o|deten[çc][ãa]o)\b|\bpena (de|aumentad|reduzid|diminu)|aumentada (de|at[ée]|em)|em dobro|\bde (um|dois|tr[êe]s|quatro|seis|1|2|3|4|6) (a|meses)|um ter[çc]o|dois ter[çc]os|metade/i;
export const MAX_POR_LOTE_COBRA_PENA = 1; // num lote de 10, no máximo 1 questão sobre quantidade de pena

/** A questão gira em torno de pena: 2 ou mais alternativas falam de quantidade de pena. */
export const cobraPena = (q: { alternativas: { texto: string }[] }) => q.alternativas.filter((a) => PADRAO_PENA.test(a.texto)).length >= 2;

/** A questão tem termo absoluto em alguma errada e nenhum na correta. */
export function absolutoSoNasErradas(q: { alternativas: { id: string; texto: string }[]; id_correta: string }) {
  const correta = q.alternativas.find((a) => a.id === q.id_correta)?.texto ?? "";
  return !PADRAO_ABSOLUTO.test(correta) && q.alternativas.some((a) => a.id !== q.id_correta && PADRAO_ABSOLUTO.test(a.texto));
}

/** Posição da correta no ranking de tamanho (1 = a mais longa) e quanto ela passa da média das outras. */
export function tamanhoDaCorreta(q: QuestaoGerada) {
  const correta = q.alternativas.find((a) => a.id === q.id_correta)?.texto.length ?? 0;
  const outras = q.alternativas.filter((a) => a.id !== q.id_correta).map((a) => a.texto.length);
  const media = outras.reduce((s, n) => s + n, 0) / Math.max(outras.length, 1);
  const posicao = 1 + outras.filter((n) => n > correta).length;
  const maisCurta = outras.length > 0 && outras.every((n) => n > correta);
  return { correta, media: Math.round(media), posicao, razao: media ? correta / media : 1, maisLonga: posicao === 1, maisCurta };
}

/** Regras do lote inteiro que uma questão sozinha não mostra (limites para um lote de 10, proporcionais). */
export function conferirLote(questoes: QuestaoGerada[]): string[] {
  if (questoes.length < 5) return [];
  const proporcional = (max: number) => Math.round((max * questoes.length) / 10);
  const erros: string[] = [];
  const longas = questoes.filter((q) => tamanhoDaCorreta(q).maisLonga).map((q) => q.id);
  const curtas = questoes.filter((q) => tamanhoDaCorreta(q).maisCurta).map((q) => q.id);
  const absolutos = questoes.filter(absolutoSoNasErradas).map((q) => q.id);
  if (longas.length > proporcional(MAX_POR_LOTE_MAIS_LONGA))
    erros.push(`a correta é a alternativa mais longa em ${longas.length} questões (${longas.join(", ")}); o máximo no lote é ${proporcional(MAX_POR_LOTE_MAIS_LONGA)}. Reescreva algumas para que uma errada seja a mais longa.`);
  if (curtas.length > proporcional(MAX_POR_LOTE_MAIS_CURTA))
    erros.push(`a correta é a alternativa mais curta em ${curtas.length} questões (${curtas.join(", ")}); o máximo no lote é ${proporcional(MAX_POR_LOTE_MAIS_CURTA)}. Deixe as erradas mais enxutas ou a correta mais completa, com o mesmo tom.`);
  const penas = questoes.filter(cobraPena).map((q) => q.id);
  if (penas.length > MAX_POR_LOTE_COBRA_PENA)
    erros.push(
      `${penas.length} questões têm alternativas que giram em torno de quantidade de pena (${penas.join(", ")}); o máximo no lote é ${MAX_POR_LOTE_COBRA_PENA}. Reescreva as demais para cobrar o crime (tipificação, elementares, consumação, qualificadoras como hipótese, exceções, ação penal), sem citar quantidade de pena nas alternativas.`,
    );
  if (absolutos.length > MAX_POR_LOTE_ABSOLUTO_SO_NAS_ERRADAS)
    erros.push(`termos absolutos ("sempre", "jamais", "automaticamente", "em qualquer hipótese"...) aparecem só nas erradas em ${absolutos.length} questões (${absolutos.join(", ")}); o máximo é ${MAX_POR_LOTE_ABSOLUTO_SO_NAS_ERRADAS}. Faça as erradas errarem por conteúdo (prazo, requisito, regra e exceção), não por exagero.`);
  return erros;
}

/** Regras que o esquema sozinho não expressa (número de alternativas, ids coerentes, tamanho, notas). */
export function conferirQuestao(q: QuestaoGerada, alternativas: number, sensiveis: DispositivoSensivel[] = []): string[] {
  const erros: string[] = [];
  const t = tamanhoDaCorreta(q);
  if (t.razao > LIMITE_TAMANHO)
    erros.push(
      `${q.id}: a correta tem ${t.correta} caracteres, ${Math.round((t.razao - 1) * 100)}% acima da média das erradas (${t.media}); o máximo é ${Math.round((LIMITE_TAMANHO - 1) * 100)}%. Deixe os distratores com tamanho e nível de detalhe parecidos`,
    );
  if (t.razao < LIMITE_TAMANHO_MINIMO)
    erros.push(
      `${q.id}: a correta tem ${t.correta} caracteres, ${Math.round((1 - t.razao) * 100)}% abaixo da média das erradas (${t.media}); o mínimo é ${Math.round(LIMITE_TAMANHO_MINIMO * 100)}% da média. A correta não pode se destacar por ser enxuta: iguale tamanho e tom`,
    );
  for (const d of dispositivosSemNota(q, sensiveis))
    erros.push(`${q.id}: cobra ${d} sem a nota obrigatória no comentario_geral (inconstitucionalidade, interpretação conforme ou não recepção; veja data/dispositivos-sensiveis.json)`);
  const ids = q.alternativas.map((a) => a.id);
  if (q.alternativas.length !== alternativas) erros.push(`${q.id}: tem ${q.alternativas.length} alternativas, o formato pede ${alternativas}`);
  if (new Set(ids).size !== ids.length) erros.push(`${q.id}: ids de alternativas repetidos`);
  if (!ids.includes(q.id_correta)) erros.push(`${q.id}: id_correta "${q.id_correta}" não é uma alternativa`);
  const analisados = q.analise_alternativas.map((a) => a.id);
  if (analisados.length !== ids.length || !ids.every((id) => analisados.includes(id))) erros.push(`${q.id}: análise não cobre exatamente as alternativas`);
  const corretas = q.analise_alternativas.filter((a) => a.correta).map((a) => a.id);
  if (corretas.length !== 1 || corretas[0] !== q.id_correta) erros.push(`${q.id}: análise marca como correta ${corretas.join(",") || "nenhuma"}, gabarito é ${q.id_correta}`);
  const letras = /\b(alternativa|letra|op[çc][ãa]o)\s+["“(]?[A-E]\b/i;
  for (const t of [q.enunciado, q.comentario_geral, ...q.alternativas.map((a) => a.texto), ...q.analise_alternativas.map((a) => a.justificativa)]) {
    if (letras.test(t)) {
      erros.push(`${q.id}: menciona letra de alternativa ("${t.match(letras)![0]}"), que muda ao embaralhar`);
      break;
    }
  }
  return erros;
}

// Checagem em código de jurisprudência: número de súmula, tema, informativo ou processo.
// Sem estar na lista (data/jurisprudencia.json), a questão vai para NECESSITA_DE_CONFERENCIA.
const PADRAO_JURISPRUDENCIA =
  /\b(s[úu]mulas?(\s+vinculantes?)?\s*(n[º°o.]*\s*)?\d+|temas?\s*(n[º°o.]*\s*)?\d+|informativos?\s*(n[º°o.]*\s*)?\d+|(HC|RHC|RE|REsp|AREsp|ARE|AgRg|AgInt|EREsp|ADI|ADC|ADPF|ADO|MS|RMS|Rcl|Inq|AP|CC|Pet)\s*(n[º°o.]*\s*)?\d[\d.]*)/gi;

/** Texto da questão em que se procuram citações (sem os campos de classificação). */
export function camposDeTexto(q: QuestaoGerada) {
  return [
    q.enunciado, q.comentario_geral, q.fundamento_legal, q.fundamento_jurisprudencial, q.observacao_temporal, q.pegadinha,
    q.lei_referencia, q.macete_do_riccardo ?? "", q.fique_ligado ?? "", q.cuidado_na_prova ?? "",
    ...q.alternativas.map((a) => a.texto), ...q.analise_alternativas.map((a) => a.justificativa),
  ];
}

export function citacoesJurisprudencia(q: QuestaoGerada): string[] {
  return [...new Set(camposDeTexto(q).flatMap((c) => c.match(PADRAO_JURISPRUDENCIA) ?? []).map((c) => c.replace(/\s+/g, " ").trim()))];
}

// Julgados que podem ser citados pelo número (data/jurisprudencia.json).
export type Julgado = { tribunal: string; tipo: string; numero: string; tese: string; dispositivo_afetado: string; fonte_url: string };
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** "Súmula Vinculante nº 11" e "sumula vinculante 11" viram a mesma chave. */
const chaveCitacao = (t: string) => semAcento(t).replace(/\bn[o°º.]*(?=\s*\d)/g, "").replace(/[^a-z0-9]/g, "");

/** Citações de número que NÃO estão na lista: estas levam a questão para NECESSITA_DE_CONFERENCIA. */
export function citacoesForaDaLista(q: QuestaoGerada, lista: Julgado[]) {
  const permitidas = new Set(lista.map((j) => chaveCitacao(`${j.tipo} ${j.numero}`)));
  return citacoesJurisprudencia(q).filter((c) => !permitidas.has(chaveCitacao(c)));
}

// Dispositivos com inconstitucionalidade declarada, interpretação conforme ou não recepção
// (data/dispositivos-sensiveis.json): permitidos só com nota no comentário.
export type DispositivoSensivel = {
  lei: string;
  artigos: string[];
  situacao: string;
  nota: string;
  conferido_professor: boolean;
  confirmar?: { trecho: string; padrao: string }[];
};
const NOTA_PRESENTE = /\bSTF\b|Supremo|inconstitucion|interpreta[çc][ãa]o conforme|n[ãa]o (foi )?recepcionad|n[ãa]o recep[çc][ãa]o/i;

function padraoArtigo(artigo: string) {
  const [numero, letra] = artigo.split("-");
  const sufixo = letra ? String.raw`\s*[º°o]?\s*-\s*${letra}\b` : String.raw`\s*[º°o]?(?![\d-])`;
  return new RegExp(String.raw`\bart(?:igo)?s?\.?\s*${numero}${sufixo}`, "i");
}

/** Dispositivos sensíveis citados pela questão cujo comentário não traz a nota. "sensiveis" já vem filtrado pelas leis do tópico. */
export function dispositivosSemNota(q: QuestaoGerada, sensiveis: DispositivoSensivel[]) {
  const texto = camposDeTexto(q).join("\n");
  const citados = sensiveis.flatMap((d) => d.artigos.filter((a) => padraoArtigo(a).test(texto)).map((a) => `art. ${a.replace("-", "º-")} (${d.lei})`));
  return citados.length && !NOTA_PRESENTE.test(q.comentario_geral) ? citados : [];
}

/** Trechos das notas ainda não conferidos na fonte oficial ("confirmar" em data/dispositivos-sensiveis.json) que a questão usa. */
export function trechosAConfirmar(q: QuestaoGerada, sensiveis: DispositivoSensivel[]) {
  const texto = camposDeTexto(q).join("\n");
  return sensiveis.flatMap((d) => (d.confirmar ?? []).filter((c) => new RegExp(c.padrao, "i").test(texto)).map((c) => c.trecho));
}

/** Nota como vai para o gerador: sem os trechos marcados para confirmar. */
export const notaConferida = (nota: string) => nota.replace(/\s*\[CONFIRMAR:[^\]]*\]/g, "").replace(/\s{2,}/g, " ").trim();

// ---------- Flashcards (produção automática: ~3 por lote de 10 questões) ----------

export const esquemaFlashcardGerado = z.object({
  id: texto.describe("Identificador do card no lote, ex.: f01"),
  subtema: texto,
  frente: texto.describe("Pergunta objetiva e curta"),
  verso: texto.describe("Resposta, com o dispositivo legal"),
  fundamento_legal: texto,
  lei_referencia: texto,
  palavras_chave: z.array(texto),
  cita_jurisprudencia: z.boolean(),
});

/** Saída do gerador na produção: questões e flashcards do mesmo tópico e recorte de lei. */
export const esquemaLoteProducao = z.object({
  questoes: z.array(esquemaQuestaoGerada),
  flashcards: z.array(esquemaFlashcardGerado),
  observacoes_do_lote: z.string().nullable(),
});

export const esquemaAuditoriaFlashcard = z.object({
  id: texto.describe("id do flashcard auditado"),
  status: z.enum(STATUS_AUDITORIA),
  correto_conforme_lei: z.boolean(),
  ambiguo: z.boolean(),
  problemas: z.array(
    z.object({
      tipo: z.enum(["normativo", "jurisprudencial", "ambiguidade", "gramatical", "pedagogico", "originalidade", "conjunto"]),
      gravidade: z.enum(["alta", "media", "baixa"]),
      descricao: texto,
    }),
  ),
  correcao_sugerida: z.string().nullable(),
  justificativa: texto.describe("Resumo do veredito, em 1 a 3 frases"),
});

export const esquemaLoteAuditadoProducao = z.object({
  auditorias: z.array(esquemaAuditoria),
  auditorias_flashcards: z.array(esquemaAuditoriaFlashcard),
});

export type FlashcardGerado = z.infer<typeof esquemaFlashcardGerado>;
export type LoteProducao = z.infer<typeof esquemaLoteProducao>;
export type AuditoriaFlashcardGerada = z.infer<typeof esquemaAuditoriaFlashcard>;

export const LIMITE_FRENTE = 220;
export const LIMITE_VERSO = 700;

const textosFlashcard = (f: FlashcardGerado) => [f.frente, f.verso, f.fundamento_legal, f.lei_referencia];

/** Citações de julgado fora da lista em um flashcard. */
export function citacoesFlashcardForaDaLista(f: FlashcardGerado, lista: Julgado[]) {
  const permitidas = new Set(lista.map((j) => chaveCitacao(`${j.tipo} ${j.numero}`)));
  const achadas = [...new Set(textosFlashcard(f).flatMap((c) => c.match(PADRAO_JURISPRUDENCIA) ?? []).map((c) => c.replace(/\s+/g, " ").trim()))];
  return achadas.filter((c) => !permitidas.has(chaveCitacao(c)));
}

/** Dispositivos sensíveis que o texto cita (com ou sem nota). Na produção, qualquer um manda para a fila manual. */
export function artigosSensiveisCitados(textos: string[], sensiveis: DispositivoSensivel[]) {
  const t = textos.join("\n");
  return sensiveis.flatMap((d) => d.artigos.filter((a) => padraoArtigo(a).test(t)).map((a) => `art. ${a.replace("-", "º-")} (${d.lei})`));
}

/** Idem para questões. */
export const sensiveisCitadosQuestao = (q: QuestaoGerada, sensiveis: DispositivoSensivel[]) => artigosSensiveisCitados(camposDeTexto(q), sensiveis);

/**
 * Regras do flashcard que o esquema não expressa: frente curta e em forma de pergunta, verso com o
 * dispositivo (quando o tópico tem lei), nota obrigatória em dispositivo sensível e sem copiar enunciado.
 */
export function conferirFlashcard(f: FlashcardGerado, opcoes: { temLei: boolean; sensiveis: DispositivoSensivel[]; enunciados: string[] }) {
  const erros: string[] = [];
  if (f.frente.length > LIMITE_FRENTE) erros.push(`${f.id}: frente com ${f.frente.length} caracteres; o máximo é ${LIMITE_FRENTE} (pergunta curta e objetiva)`);
  if (!f.frente.trim().endsWith("?")) erros.push(`${f.id}: a frente deve ser uma pergunta (terminar com "?")`);
  if (f.verso.length > LIMITE_VERSO) erros.push(`${f.id}: verso com ${f.verso.length} caracteres; o máximo é ${LIMITE_VERSO}`);
  if (opcoes.temLei && !/\bart(igo)?s?\.?\s*\d|§|\binciso\b|\bLei\b|\bCF\b|\bCP\b|\bCPP\b/i.test(f.verso))
    erros.push(`${f.id}: o verso precisa citar o dispositivo legal (ex.: "art. 14 do CPP")`);
  const citados = artigosSensiveisCitados(textosFlashcard(f), opcoes.sensiveis);
  if (citados.length && !NOTA_PRESENTE.test(f.verso)) erros.push(`${f.id}: cita ${citados.join(", ")} sem a nota obrigatória no verso`);
  for (const e of opcoes.enunciados) {
    if (semelhancaSimples(f.frente, e) >= 0.6) {
      erros.push(`${f.id}: a frente repete o enunciado de uma questão do lote; o card deve ter redação própria`);
      break;
    }
  }
  return erros;
}

// Semelhança por pares de letras (a mesma ideia de src/lib/catalogo.ts, sem depender dele aqui).
function semelhancaSimples(a: string, b: string) {
  const pares = (t: string) => {
    const s = semAcento(t).replace(/[^a-z0-9]/g, "");
    return Array.from({ length: Math.max(s.length - 1, 0) }, (_, i) => s.slice(i, i + 2));
  };
  const pa = pares(a);
  const resto = pares(b);
  if (!pa.length || !resto.length) return 0;
  const total = pa.length + resto.length;
  let comuns = 0;
  for (const p of pa) {
    const i = resto.indexOf(p);
    if (i >= 0) {
      comuns++;
      resto.splice(i, 1);
    }
  }
  return (2 * comuns) / total;
}
