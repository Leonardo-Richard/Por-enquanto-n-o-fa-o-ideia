/** Validação e formatação de CNPJ (apenas dígitos verificadores). */

export function sanitizeCnpj(input: string): string {
  return input.replace(/\D/g, "").slice(0, 14);
}

/** CNPJ mascarado para listagens (sem expor dígitos centrais). */
export function maskCnpjDigits(digits: string): string {
  const d = sanitizeCnpj(digits);
  if (d.length !== 14) {
    return d;
  }
  return `${d.slice(0, 2)}.***.***/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function formatCnpj(digits: string): string {
  const d = sanitizeCnpj(digits);
  if (d.length !== 14) {
    return d;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

/** Formata 14 dígitos; caso contrário devolve o texto (ex.: CNPJ mascarado da listagem). */
export function displayCnpjLabel(value: string): string {
  const d = sanitizeCnpj(value);
  return d.length === 14 ? formatCnpj(d) : value;
}

const WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

function checkDigit(digits: string, weights: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += parseInt(digits[i]!, 10) * weights[i]!;
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

export function isValidCnpj(input: string): boolean {
  const c = sanitizeCnpj(input);
  if (c.length !== 14) {
    return false;
  }
  if (/^(\d)\1{13}$/.test(c)) {
    return false;
  }

  const d1 = checkDigit(c.slice(0, 12), WEIGHTS_1);
  if (parseInt(c[12]!, 10) !== d1) {
    return false;
  }
  const d2 = checkDigit(c.slice(0, 13), WEIGHTS_2);
  return parseInt(c[13]!, 10) === d2;
}
