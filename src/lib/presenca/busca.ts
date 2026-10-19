/** Minúsculas, sem acento e sem espaços sobrando: "  José  " -> "jose". */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type ComNomeRga = { nome: string; rga: string | null };

/**
 * Filtra por nome ou RGA. Busca só com números (ou pontuação) compara com o RGA
 * ignorando pontos e traços; senão, todas as palavras digitadas precisam aparecer
 * no nome (em qualquer ordem) ou no RGA.
 */
export function filtrarPorBusca<T extends ComNomeRga>(itens: T[], busca: string): T[] {
  const termo = normalizarBusca(busca);
  if (!termo) return itens;

  if (!/\p{L}/u.test(termo)) {
    const digitos = termo.replace(/\D/g, "");
    if (!digitos) return itens;
    return itens.filter((i) => (i.rga ?? "").replace(/\D/g, "").includes(digitos));
  }

  const palavras = termo.split(" ");
  return itens.filter((i) => {
    const alvo = normalizarBusca(`${i.nome} ${i.rga ?? ""}`);
    return palavras.every((p) => alvo.includes(p));
  });
}
