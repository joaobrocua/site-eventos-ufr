/** Endereço da página: "Semana de Engenharia 2026!" -> "semana-de-engenharia-2026". */
export function gerarSlug(texto: string, max = 80) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}
