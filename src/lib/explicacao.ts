// Explicação de um artigo de lei no Vade Mecum (usada na tela do aluno e na revisão do professor).
import { z } from "zod";

export type Explicacao = { sentido: string; pontos: string[]; exemplo: string; pegadinha: string | null };

/** O que o professor pode editar antes de aprovar. */
export const esquemaExplicacao = z.object({
  sentido: z.string().trim().min(10, "Escreva o sentido do artigo.").max(2_000),
  pontos: z.array(z.string().trim().min(3).max(600)).min(1, "Pelo menos um ponto.").max(10),
  exemplo: z.string().trim().min(10, "Escreva um exemplo.").max(1_500),
  pegadinha: z.string().trim().max(800).nullable(),
});

export const STATUS_EXPLICACAO = ["pendente", "aprovada", "rejeitada"] as const;
export type StatusExplicacao = (typeof STATUS_EXPLICACAO)[number];
