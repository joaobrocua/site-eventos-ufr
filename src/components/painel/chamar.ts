import { toast } from "sonner";
import type { ResultadoAcao } from "@/lib/erros";

export const MSG_SEM_CONEXAO = "Sem conexão. Tente novamente.";

/** Executa uma server action e transforma falha de rede em ResultadoAcao (não derruba a página). */
export async function chamar<T = undefined>(
  fn: () => Promise<ResultadoAcao<T>>,
): Promise<ResultadoAcao<T>> {
  try {
    return await fn();
  } catch {
    return { ok: false, erro: MSG_SEM_CONEXAO };
  }
}

/** Baixa um arquivo da rota de exportação; erros viram toast com a mensagem do JSON {erro}. */
export async function baixarArquivo(url: string, nomePadrao: string) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const corpo = await resp.json().catch(() => null);
      toast.error(corpo?.erro ?? "Não foi possível baixar a lista.");
      return;
    }
    const disp = resp.headers.get("Content-Disposition") ?? "";
    const nome = /filename="([^"]+)"/.exec(disp)?.[1] ?? nomePadrao;
    const blob = await resp.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  } catch {
    toast.error(MSG_SEM_CONEXAO);
  }
}
