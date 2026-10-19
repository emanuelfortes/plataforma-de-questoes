// Revisão das questões geradas por IA (tabela questoes_revisao). Usado pela tela /admin/revisao
// e pela aprovação, que copia a questão para "questoes".
import type { AnaliseAlternativa } from "@/db/schema/revisao";

export const STATUS_REVISAO = ["pendente_revisao", "aprovada", "rejeitada"] as const;
export type StatusRevisao = (typeof STATUS_REVISAO)[number];

export const ROTULO_STATUS_REVISAO: Record<StatusRevisao, string> = {
  pendente_revisao: "Pendentes",
  aprovada: "Aprovadas",
  rejeitada: "Rejeitadas",
};

export const ROTULO_AUDITORIA: Record<string, string> = {
  VALIDADA: "Validada",
  VALIDADA_COM_RESSALVA: "Com ressalva",
  NECESSITA_DE_CONFERENCIA: "Conferir",
};

const ROTULO_DESTAQUE: Record<string, string> = {
  macete_do_riccardo: "MACETE DO RICCARDO",
  fique_ligado: "FIQUE LIGADO",
  cuidado_na_prova: "CUIDADO NA PROVA",
};

type PartesComentario = {
  comentario: string;
  analiseAlternativas: AnaliseAlternativa[];
  fundamentoLegal: string | null;
  fundamentoJurisprudencial: string | null;
  observacaoTemporal: string | null;
  pegadinha: string | null;
  destaques: { tipo: string; texto: string }[] | null;
};

/**
 * Comentário único que vai para "questoes.comentario" (o aluno vê com quebras de linha, depois de
 * responder): explicação geral, análise de cada alternativa, fundamentos, pegadinha e destaques.
 */
export function montarComentario(p: PartesComentario) {
  // Campos sem conteúdo útil ("Não se aplica", com ou sem explicação) não aparecem para o aluno.
  const util = (t: string | null) => (t && !/^n[ãa]o se aplica\b/i.test(t.trim()) ? t : null);
  const blocos = [p.comentario.trim()];
  if (p.analiseAlternativas.length)
    blocos.push(
      ["Análise das alternativas:", ...p.analiseAlternativas.map((a) => `${a.letra}) ${a.correta ? "Correta" : "Errada"}. ${a.justificativa}`)].join("\n"),
    );
  if (util(p.fundamentoLegal)) blocos.push(`Fundamento legal: ${p.fundamentoLegal}`);
  if (util(p.fundamentoJurisprudencial)) blocos.push(`Jurisprudência: ${p.fundamentoJurisprudencial}`);
  if (util(p.pegadinha)) blocos.push(`Pegadinha: ${p.pegadinha}`);
  for (const d of p.destaques ?? []) blocos.push(`${ROTULO_DESTAQUE[d.tipo] ?? d.tipo}: ${d.texto}`);
  if (util(p.observacaoTemporal)) blocos.push(`Atualização: ${p.observacaoTemporal}`);
  return blocos.join("\n\n");
}

/** Banca mostrada ao aluno: deixa claro que é questão inédita no estilo da banca, não questão de prova. */
export const bancaInedita = (banca: string) => `Inédita (estilo ${banca})`;
