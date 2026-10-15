// Contrato do arquivo de importação (.jsonl, um objeto por linha).
// Documentação completa em docs/FORMATO-QUESTOES.md. Mantenha os dois em sincronia.
import { z } from "zod";

const textoObrigatorio = z.string().trim().min(1);

export const esquemaAlternativa = z.object({
  letra: z.string().trim().regex(/^[A-Z]$/, "letra deve ser uma única letra maiúscula"),
  texto: textoObrigatorio,
});

export const esquemaQuestao = z
  .object({
    tipo: z.literal("multipla"),
    id: textoObrigatorio,
    disciplina: textoObrigatorio,
    assunto: z.string().trim().min(1).optional(),
    banca: z.string().trim().min(1).optional(),
    ano: z.number().int().min(1900).max(2100).optional(),
    enunciado: textoObrigatorio,
    alternativas: z.array(esquemaAlternativa).min(2).max(6),
    gabarito: z.string().trim().regex(/^[A-Z]$/),
    comentario: z.string().trim().min(1).optional(),
  })
  .refine((q) => q.alternativas.some((a) => a.letra === q.gabarito), {
    message: "gabarito não corresponde a nenhuma alternativa",
    path: ["gabarito"],
  })
  .refine((q) => new Set(q.alternativas.map((a) => a.letra)).size === q.alternativas.length, {
    message: "letras das alternativas repetidas",
    path: ["alternativas"],
  });

export const esquemaFlashcard = z.object({
  tipo: z.literal("flashcard"),
  id: textoObrigatorio,
  disciplina: textoObrigatorio,
  assunto: z.string().trim().min(1).optional(),
  frente: textoObrigatorio,
  verso: textoObrigatorio,
});

export const esquemaLinha = z.union([esquemaQuestao, esquemaFlashcard]);

export type LinhaQuestao = z.infer<typeof esquemaQuestao>;
export type LinhaFlashcard = z.infer<typeof esquemaFlashcard>;
export type LinhaImportacao = z.infer<typeof esquemaLinha>;
