/** Só aceita caminhos internos em ?proximo= (evita redirecionar para outro site). */
export function caminhoSeguro(proximo: string | null | undefined, padrao = "/") {
  if (
    !proximo ||
    !proximo.startsWith("/") ||
    proximo.startsWith("//") ||
    proximo.includes("\\") ||
    /[\u0000-\u001f]/.test(proximo)
  ) {
    return padrao;
  }
  return proximo;
}
