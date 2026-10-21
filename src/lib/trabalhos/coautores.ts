export const MAX_COAUTORES = 15;

/** Tira espaços sobrando, junta espaços repetidos e descarta linhas em branco. */
export function normalizarCoautores(nomes: string[]): string[] {
  return nomes.map((n) => n.replace(/\s+/g, " ").trim()).filter((n) => n.length > 0);
}
