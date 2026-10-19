import { formatarData, formatarHora } from "@/lib/datas";

const BOM = "\uFEFF";

/**
 * Protege contra injeção de fórmula no Excel: valores que começam com
 * = + - @ ou tab/CR viram texto com um apóstrofo na frente.
 */
export function neutralizarFormula(valor: string) {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

/** Uma célula do CSV: neutraliza fórmulas e escapa ; " e quebras de linha. */
export function celulaCsv(valor: string | null | undefined) {
  const texto = neutralizarFormula(valor ?? "");
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV para Excel brasileiro: separador ";", CRLF e BOM UTF-8 (acentos corretos). */
export function montarCsv(linhas: ReadonlyArray<ReadonlyArray<string | null | undefined>>) {
  return BOM + linhas.map((l) => l.map(celulaCsv).join(";")).join("\r\n") + "\r\n";
}

export const CABECALHO_EXPORTACAO = [
  "Nome",
  "E-mail",
  "RGA",
  "Curso",
  "Telefone",
  "Atividade(s)",
  "Presente",
  "Data/hora da presença (Cuiabá)",
] as const;

export type InscritoExportacao = {
  nome: string;
  email: string;
  rga: string | null;
  curso: string | null;
  telefone: string | null;
  atividades: { atividade_id: string; presente_em: string | null }[];
};

/**
 * Uma linha por inscrito x atividade. Sem filtro, quem não escolheu atividade
 * aparece em uma linha com a coluna de atividade vazia. Com `atividadeId`,
 * só quem está inscrito naquela atividade.
 */
export function linhasDeExportacao(
  inscritos: InscritoExportacao[],
  titulos: Record<string, string>,
  atividadeId?: string | null,
) {
  const linhas: string[][] = [[...CABECALHO_EXPORTACAO]];
  for (const i of inscritos) {
    const base = [i.nome, i.email, i.rga ?? "", i.curso ?? "", i.telefone ?? ""];
    const escolhidas = atividadeId
      ? i.atividades.filter((a) => a.atividade_id === atividadeId)
      : i.atividades;
    if (atividadeId && escolhidas.length === 0) continue;
    if (escolhidas.length === 0) {
      linhas.push([...base, "", "Não", ""]);
      continue;
    }
    for (const a of escolhidas) {
      linhas.push([
        ...base,
        titulos[a.atividade_id] ?? "",
        a.presente_em ? "Sim" : "Não",
        a.presente_em ? `${formatarData(a.presente_em)} ${formatarHora(a.presente_em)}` : "",
      ]);
    }
  }
  return linhas;
}
