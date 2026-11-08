// Validação de CPF, celular e CEP (formulário do cartão e servidor usam as mesmas regras).

export const soDigitos = (texto: string) => texto.replace(/\D/g, "");

/** CPF com os dígitos verificadores certos (aceita com ou sem pontuação). */
export function cpfValido(texto: string) {
  const cpf = soDigitos(texto);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/** Celular ou fixo com DDD: 10 ou 11 dígitos, sem o 55. */
export const telefoneValido = (texto: string) => /^[1-9]{2}9?\d{8}$/.test(soDigitos(texto));

export const cepValido = (texto: string) => /^\d{8}$/.test(soDigitos(texto));

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
