import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { InscritoPainel } from "./inscritos";

type Cliente = Awaited<ReturnType<typeof createClient>>;

export type InscritoCompleto = InscritoPainel & { telefone: string | null };

const TAMANHO_PAGINA = 1000;

/**
 * Inscritos CONFIRMADOS de um evento, com perfil e atividades.
 * O PostgREST devolve no máximo ~1000 linhas por consulta; por isso paginamos.
 * Nunca seleciona inscricoes.codigo (o conteúdo do QR code).
 */
export async function buscarInscritos(
  supabase: Cliente,
  eventoId: string,
): Promise<{ dados: InscritoCompleto[]; erro: unknown }> {
  const dados: InscritoCompleto[] = [];
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await supabase
      .from("inscricoes")
      .select(
        "id, status, criado_em, perfis(nome_completo, email, rga, curso, telefone), inscricoes_atividades(atividade_id, status, presente_em)",
      )
      .eq("evento_id", eventoId)
      .eq("status", "confirmada")
      .order("criado_em", { ascending: true })
      .order("id", { ascending: true })
      .range(inicio, inicio + TAMANHO_PAGINA - 1);
    if (error) return { dados: [], erro: error };

    for (const linha of data) {
      const perfil = Array.isArray(linha.perfis) ? linha.perfis[0] : linha.perfis;
      dados.push({
        id: linha.id,
        nome: perfil?.nome_completo ?? "(sem nome)",
        email: perfil?.email ?? "",
        rga: perfil?.rga ?? null,
        curso: perfil?.curso ?? null,
        telefone: perfil?.telefone ?? null,
        atividades: (linha.inscricoes_atividades ?? [])
          .filter((a) => a.status === "confirmada")
          .map((a) => ({ atividade_id: a.atividade_id, presente_em: a.presente_em })),
      });
    }
    if (data.length < TAMANHO_PAGINA) break;
  }
  dados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { dados, erro: null };
}
