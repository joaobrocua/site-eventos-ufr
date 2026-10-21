import { TAMANHO_MAX_PDF } from "@/lib/tipos";

/** Mensagem de erro para o PDF escolhido, ou null se estiver ok. */
export function validarPdf(arquivo: { name: string; type: string; size: number }): string | null {
  const ehPdf = arquivo.type === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf");
  if (!ehPdf) return "O arquivo precisa ser um PDF.";
  if (arquivo.size === 0) return "O arquivo está vazio.";
  if (arquivo.size > TAMANHO_MAX_PDF) {
    return `O PDF pode ter no máximo ${TAMANHO_MAX_PDF / (1024 * 1024)} MB.`;
  }
  return null;
}

/** Todo PDF começa com "%PDF". */
export function cabecalhoEhPdf(inicio: string): boolean {
  return inicio.startsWith("%PDF");
}

/** Confere o conteúdo (não só o nome): lê os primeiros bytes do arquivo. */
export async function validarConteudoPdf(arquivo: Blob): Promise<string | null> {
  try {
    const inicio = await arquivo.slice(0, 5).text();
    return cabecalhoEhPdf(inicio) ? null : "Este arquivo não parece ser um PDF.";
  } catch {
    return "Não foi possível ler o arquivo. Escolha-o de novo.";
  }
}
