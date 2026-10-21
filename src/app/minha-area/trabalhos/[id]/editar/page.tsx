import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ModalidadeTrabalho } from "@/lib/tipos";
import { acoesPermitidas } from "@/lib/trabalhos/permissoes";
import { estadoSubmissao } from "@/lib/trabalhos/prazo";
import { Button } from "@/components/ui/button";
import { FormularioTrabalho } from "@/components/trabalhos/formulario-trabalho";

export const metadata: Metadata = { title: "Editar trabalho" };

export default async function PaginaEditarTrabalho({
  params,
}: PageProps<"/minha-area/trabalhos/[id]/editar">) {
  const { id } = await params;
  const perfil = await exigirPerfil(`/minha-area/trabalhos/${id}/editar`);
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: t } = await supabase
    .from("trabalhos")
    .select("*, eventos(titulo, status, submissoes_abertas, submissoes_ate, areas_tematicas)")
    .eq("id", id)
    .eq("autor_id", perfil.id)
    .maybeSingle();
  if (!t || !t.eventos) notFound();

  const prazo = estadoSubmissao(t.eventos, new Date());
  const podeEditar = acoesPermitidas(t, prazo.aberto, t.eventos.status === "publicado").editar;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:py-12">
      <Link href="/minha-area/trabalhos" className="text-base text-primary underline-offset-4 hover:underline">
        ← Meus trabalhos
      </Link>
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Editar trabalho</h1>
        <p className="text-muted-foreground">{t.eventos.titulo}</p>
      </header>

      {podeEditar ? (
        <FormularioTrabalho
          trabalhoId={t.id}
          areas={t.eventos.areas_tematicas}
          temPdf={t.arquivo_path !== null}
          inicial={{
            titulo: t.titulo,
            resumo: t.resumo,
            palavrasChave: t.palavras_chave ?? "",
            area: t.area ?? "",
            modalidade: t.modalidade as ModalidadeTrabalho,
            coautores: Array.isArray(t.coautores) ? t.coautores.filter((c) => typeof c === "string") : [],
          }}
        />
      ) : (
        <div role="status" className="space-y-3 rounded-xl bg-warning/15 p-4">
          <p className="text-base font-medium">
            {t.status !== "submetido"
              ? "Este trabalho já foi avaliado ou retirado e não pode mais ser alterado."
              : !prazo.aberto
                ? prazo.mensagem
                : "Este trabalho não pode ser alterado."}
          </p>
          <Button
            variant="outline"
            className="h-11 text-base"
            render={<Link href="/minha-area/trabalhos" />}
            nativeButton={false}
          >
            Voltar para meus trabalhos
          </Button>
        </div>
      )}
    </div>
  );
}
