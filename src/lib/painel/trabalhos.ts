import type { StatusTrabalho } from "@/lib/tipos";

/** Trabalho já "achatado" para o painel. */
export type TrabalhoPainel = {
  id: string;
  titulo: string;
  area: string | null;
  modalidade: string;
  temArquivo: boolean;
  status: StatusTrabalho;
  parecer: string | null;
  atividade_id: string | null;
  ordem_apresentacao: number | null;
  autor: string;
  autor_email: string;
};

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Dados pesados do trabalho, carregados só ao abrir o detalhe. */
export type DetalheTrabalhoDados = {
  resumo: string;
  palavras_chave: string | null;
  coautores: string[];
};

/** O jsonb de coautores deveria ser um array de nomes; aceita só textos. */
export function coautoresComoLista(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
}

export function filtrarTrabalhos(
  trabalhos: TrabalhoPainel[],
  busca: string,
  status: StatusTrabalho | null,
  area: string | null,
) {
  const termo = normalizar(busca.trim());
  return trabalhos.filter((t) => {
    if (status && t.status !== status) return false;
    if (area && t.area !== area) return false;
    if (!termo) return true;
    return [t.titulo, t.autor, t.autor_email].some((c) => normalizar(c).includes(termo));
  });
}

export function contarPorStatus(trabalhos: Pick<TrabalhoPainel, "status">[]) {
  const c: Record<StatusTrabalho, number> = { submetido: 0, aprovado: 0, reprovado: 0, retirado: 0 };
  for (const t of trabalhos) c[t.status] += 1;
  return c;
}
