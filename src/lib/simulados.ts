// Regras dos simulados do Elite usadas no servidor e na tela (correção, tempo, leitura do gabarito).

/** Opções de marcação de cada questão. */
export const OPCOES_SIMULADO = { ABCD: "A a D", ABCDE: "A a E", CE: "Certo ou errado" } as const;
export type OpcoesSimulado = keyof typeof OPCOES_SIMULADO;

/** Marca de questão anulada no gabarito oficial: vale ponto para todos. */
export const ANULADA = "X";

/** Tamanho de cada pedaço do PDF no envio (a Vercel recusa requisições acima de ~4,5 MB). */
export const TAMANHO_PARTE = 3 * 1024 * 1024;
export const MAXIMO_PDF = 60 * 1024 * 1024;

/** Depois do tempo, o servidor ainda aceita a entrega por este tanto (internet lenta no último segundo). */
export const FOLGA_ENTREGA_SEG = 120;

/**
 * Gabarito digitado pelo professor: "ABCDA..." ou "1-A, 2-B..." ou uma letra por linha. Devolve uma letra por
 * questão (só as letras permitidas e X) ou o motivo do erro.
 */
export function lerGabarito(texto: string, opcoes: OpcoesSimulado, questoes: number): { ok: true; gabarito: string[] } | { ok: false; erro: string } {
  const limpo = texto.toUpperCase().replace(/\b\d+\s*[-.):]?\s*/g, "");
  const letras = [...limpo].filter((c) => /[A-Z]/.test(c));
  const validas = new Set([...opcoes, ANULADA]);
  const invalida = letras.find((l) => !validas.has(l));
  if (invalida) return { ok: false, erro: `A letra "${invalida}" não vale neste simulado (use ${[...opcoes].join(", ")} ou X para anulada).` };
  if (letras.length !== questoes) return { ok: false, erro: `O gabarito tem ${letras.length} letras, mas o simulado tem ${questoes} questões.` };
  return { ok: true, gabarito: letras };
}

export function corrigir(gabarito: string[], respostas: string[]) {
  return gabarito.reduce((n, certa, i) => n + (certa === ANULADA || (respostas[i] && respostas[i] === certa) ? 1 : 0), 0);
}

/** Segundos que faltam (pode ser negativo) para a tentativa começada em `inicio`. */
export function segundosRestantes(inicio: Date, duracaoMin: number, agora = Date.now()) {
  return Math.floor((inicio.getTime() + duracaoMin * 60_000 - agora) / 1000);
}

export function formatarTempo(segundos: number) {
  const s = Math.max(0, segundos);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${dois(m)}:${dois(ss)}` : `${dois(m)}:${dois(ss)}`;
}
