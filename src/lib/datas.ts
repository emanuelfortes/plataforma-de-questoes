// O Brasil (horário de Brasília) está em UTC-3 fixo desde 2019, sem horário de verão.
// Guardamos tudo em UTC e aplicamos este deslocamento só ao agrupar por "dia do aluno".
// Se um dia precisar de outros fusos, troque por um fuso por usuário (coluna em "user").
export const DESLOCAMENTO_SQLITE = "-3 hours";
export const DESLOCAMENTO_MS = -3 * 60 * 60 * 1000;

export function agoraEmSegundos() {
  return Math.floor(Date.now() / 1000);
}

/** Data AAAA-MM-DD no fuso de Brasília. */
export function diaLocal(data: Date = new Date()) {
  return new Date(data.getTime() + DESLOCAMENTO_MS).toISOString().slice(0, 10);
}

/** Lista os últimos `n` dias (do mais antigo para hoje) no formato AAAA-MM-DD. */
export function ultimosDias(n: number) {
  const hoje = Date.now();
  return Array.from({ length: n }, (_, i) =>
    diaLocal(new Date(hoje - (n - 1 - i) * 24 * 60 * 60 * 1000)),
  );
}

export function rotuloDia(iso: string) {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}
