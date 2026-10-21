/** Inscrito já "achatado" para a tabela do painel. Sem o código do QR. */
export type InscritoPainel = {
  id: string;
  nome: string;
  email: string;
  rga: string | null;
  curso: string | null;
  atividades: { atividade_id: string; presente_em: string | null }[];
  /** Atividades em que está só na lista de espera (não contam como inscrito nelas). */
  fila: string[];
};

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Busca por nome/e-mail/RGA (sem acentos) e filtro opcional por atividade. */
export function filtrarInscritos(
  inscritos: InscritoPainel[],
  busca: string,
  atividadeId: string | null,
) {
  const termo = normalizar(busca.trim());
  return inscritos.filter((i) => {
    if (atividadeId && !i.atividades.some((a) => a.atividade_id === atividadeId)) return false;
    if (!termo) return true;
    return [i.nome, i.email, i.rga ?? ""].some((c) => normalizar(c).includes(termo));
  });
}
