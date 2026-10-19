import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirOrganizador } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { escolherAtividadePadrao } from "@/lib/presenca/atividade-padrao";
import type { Inscrito } from "@/lib/presenca/tipos";
import { PainelPresenca } from "@/components/presenca/painel-presenca";

const TAMANHO_PAGINA = 1000;

export async function generateMetadata({
  params,
}: PageProps<"/painel/eventos/[id]/presenca">): Promise<Metadata> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return { title: "Presença" };
  const supabase = await createClient();
  const { data } = await supabase.from("eventos").select("titulo").eq("id", id).maybeSingle();
  return { title: data ? `Presença · ${data.titulo}` : "Presença" };
}

export default async function PaginaPresenca({
  params,
  searchParams,
}: PageProps<"/painel/eventos/[id]/presenca">) {
  await exigirOrganizador();

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, titulo, status")
    .eq("id", id)
    .maybeSingle();
  if (!evento) notFound();

  const { data: atividades, error: erroAtividades } = await supabase
    .from("atividades")
    .select("id, titulo, tipo, inicio, fim")
    .eq("evento_id", id)
    .order("inicio");
  if (erroAtividades) throw new Error("Não foi possível carregar as atividades.");

  const voltar = (
    <Link href={`/painel/eventos/${id}`} className="text-base text-primary underline-offset-4 hover:underline">
      ← Voltar ao evento
    </Link>
  );

  if (!atividades || atividades.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {voltar}
        <h1 className="text-2xl font-bold">Presença</h1>
        <p className="rounded-xl border p-6 text-center text-base text-muted-foreground">
          Este evento ainda não tem atividades. Cadastre uma atividade para registrar presença.
        </p>
      </div>
    );
  }

  const { atividade: pedida } = await searchParams;
  const pedidaId = Array.isArray(pedida) ? pedida[0] : pedida;
  const atividadeId =
    atividades.find((a) => a.id === pedidaId)?.id ?? escolherAtividadePadrao(atividades, new Date())!;

  // Nunca selecionamos inscricoes.codigo: o código do QR não sai do servidor.
  // O PostgREST devolve no máximo 1000 linhas por consulta: lemos em lotes.
  const linhas = [];
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await supabase
      .from("inscricoes_atividades")
      .select("inscricao_id, presente_em, inscricoes!inner(id, status, perfis(nome_completo, rga, curso))")
      .eq("atividade_id", atividadeId)
      .eq("status", "confirmada")
      .eq("inscricoes.status", "confirmada")
      .order("inscricao_id")
      .range(inicio, inicio + TAMANHO_PAGINA - 1);
    if (error) throw new Error("Não foi possível carregar os inscritos.");
    linhas.push(...data);
    if (data.length < TAMANHO_PAGINA) break;
  }

  const inscritos: Inscrito[] = linhas
    .map((l) => ({
      inscricaoId: l.inscricao_id,
      nome: l.inscricoes?.perfis?.nome_completo ?? "Sem nome",
      rga: l.inscricoes?.perfis?.rga ?? null,
      curso: l.inscricoes?.perfis?.curso ?? null,
      presenteEm: l.presente_em,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      {voltar}
      <div>
        <h1 className="text-2xl font-bold">Presença</h1>
        <p className="text-base text-muted-foreground">{evento.titulo}</p>
      </div>
      {evento.status !== "publicado" && (
        <p role="alert" className="rounded-xl bg-warning/15 p-4 text-base font-medium">
          Este evento não está publicado. A presença só pode ser registrada com o evento publicado.
        </p>
      )}
      <PainelPresenca
        key={atividadeId}
        eventoId={id}
        atividades={atividades}
        atividadeId={atividadeId}
        inscritos={inscritos}
      />
    </div>
  );
}
