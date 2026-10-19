import { obterPapel } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { linhasDeExportacao, montarCsv } from "@/lib/painel/csv";
import { buscarInscritos } from "@/lib/painel/dados";
import { idSchema } from "@/lib/painel/schemas";
import { gerarSlug } from "@/lib/painel/slug";

// Sem cache: é dado pessoal e muda a cada inscrição.
export const dynamic = "force-dynamic";

const json = (corpo: { erro: string }, status: number) => Response.json(corpo, { status });

export async function GET(request: Request, ctx: RouteContext<"/painel/eventos/[id]/exportar">) {
  // O layout do painel não protege route handlers: verificamos aqui.
  if (!(await obterPapel())) return json({ erro: "Sem permissão." }, 403);

  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) return json({ erro: "Evento inválido." }, 400);

  const atividadeParam = new URL(request.url).searchParams.get("atividade");
  if (atividadeParam !== null && !idSchema.safeParse(atividadeParam).success) {
    return json({ erro: "Atividade inválida." }, 400);
  }

  const supabase = await createClient();
  const { data: evento } = await supabase.from("eventos").select("id, slug").eq("id", id).maybeSingle();
  if (!evento) return json({ erro: "Evento não encontrado." }, 404);

  const { data: atividades, error: erroAtividades } = await supabase
    .from("atividades")
    .select("id, titulo")
    .eq("evento_id", id);
  if (erroAtividades) return json({ erro: "Não foi possível gerar a lista." }, 500);

  let atividadeId: string | null = null;
  let nomeAtividade = "";
  if (atividadeParam) {
    const atividade = atividades.find((a) => a.id === atividadeParam);
    if (!atividade) return json({ erro: "Atividade não encontrada neste evento." }, 404);
    atividadeId = atividade.id;
    nomeAtividade = atividade.titulo;
  }

  const { dados: inscritos, erro } = await buscarInscritos(supabase, id);
  if (erro) return json({ erro: "Não foi possível gerar a lista." }, 500);

  // Auditoria ANTES de entregar os dados: se não registrar, não exporta.
  const { error: erroAuditoria } = await supabase.rpc("registrar_auditoria", {
    p_acao: "exportar_inscritos",
    p_detalhes: { evento_id: id, atividade_id: atividadeId },
  });
  if (erroAuditoria) return json({ erro: "Não foi possível registrar a exportação." }, 500);

  const titulos = Object.fromEntries(atividades.map((a) => [a.id, a.titulo]));
  const csv = montarCsv(linhasDeExportacao(inscritos, titulos, atividadeId));

  const nome = atividadeId
    ? `presenca-${evento.slug}-${gerarSlug(nomeAtividade, 40) || "atividade"}.csv`
    : `inscritos-${evento.slug}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
