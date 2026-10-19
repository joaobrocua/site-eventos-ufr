/** Normaliza o texto lido do QR (ou digitado): sem espaços nas pontas e em minúsculas. */
export function normalizarCodigo(bruto: string): string {
  return bruto.trim().toLowerCase();
}

/** O código do aluno tem exatamente 32 caracteres hexadecimais minúsculos. */
export function ehCodigoValido(codigo: string): boolean {
  return /^[0-9a-f]{32}$/.test(codigo);
}

/** Normaliza e valida; devolve null se claramente não for um código de inscrição. */
export function lerCodigo(bruto: string): string | null {
  const codigo = normalizarCodigo(bruto);
  return ehCodigoValido(codigo) ? codigo : null;
}

export const JANELA_REPETICAO_MS = 3000;

export type UltimaLeitura = { codigo: string; em: number } | null;

/** True se é o mesmo código lido há menos de `janelaMs` (a câmera lê o mesmo QR várias vezes). */
export function leituraRepetida(
  ultima: UltimaLeitura,
  codigo: string,
  agoraMs: number,
  janelaMs = JANELA_REPETICAO_MS,
): boolean {
  return ultima !== null && ultima.codigo === codigo && agoraMs - ultima.em < janelaMs;
}
