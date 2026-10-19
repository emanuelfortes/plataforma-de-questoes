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

// Pista pelo tamanho: a correta não pode ser muito mais longa que as outras.
export const LIMITE_TAMANHO = 1.25; // correta até 25% mais longa que a média das erradas
export const MAX_CORRETA_MAIS_LONGA_NO_LOTE = 0.4; // em um lote, a correta é a mais longa em no máximo 40%

/** Posição da correta no ranking de tamanho (1 = a mais longa) e quanto ela passa da média das outras. */
export function tamanhoDaCorreta(q: QuestaoGerada) {
  const correta = q.alternativas.find((a) => a.id === q.id_correta)?.texto.length ?? 0;
  const outras = q.alternativas.filter((a) => a.id !== q.id_correta).map((a) => a.texto.length);
  const media = outras.reduce((s, n) => s + n, 0) / Math.max(outras.length, 1);
  const posicao = 1 + outras.filter((n) => n > correta).length;
  return { correta, media: Math.round(media), posicao, razao: media ? correta / media : 1, maisLonga: posicao === 1 };
}

/** Regras do lote inteiro que uma questão sozinha não mostra. */
export function conferirLote(questoes: QuestaoGerada[]): string[] {
  if (questoes.length < 5) return [];
  const longas = questoes.filter((q) => tamanhoDaCorreta(q).maisLonga).map((q) => q.id);
  const limite = Math.floor(questoes.length * MAX_CORRETA_MAIS_LONGA_NO_LOTE);
  return longas.length > limite
    ? [`a correta é a alternativa mais longa em ${longas.length} de ${questoes.length} questões (${longas.join(", ")}); o máximo é ${limite}. Reescreva algumas para que uma errada seja a mais longa.`]
    : [];
}

/** Regras que o esquema sozinho não expressa (número de alternativas, ids coerentes, tamanho, notas). */
export function conferirQuestao(q: QuestaoGerada, alternativas: number, sensiveis: DispositivoSensivel[] = []): string[] {
  const erros: string[] = [];
  const t = tamanhoDaCorreta(q);
  if (t.razao > LIMITE_TAMANHO)
    erros.push(
      `${q.id}: a correta tem ${t.correta} caracteres, ${Math.round((t.razao - 1) * 100)}% acima da média das erradas (${t.media}); o máximo é ${Math.round((LIMITE_TAMANHO - 1) * 100)}%. Deixe os distratores com tamanho e nível de detalhe parecidos`,
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
function camposDeTexto(q: QuestaoGerada) {
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
