import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirPerfil } from "@/lib/auth";
import { formatarData, formatarHora } from "@/lib/datas";
import { createClient } from "@/lib/supabase/server";
import { estadoSubmissao } from "@/lib/trabalhos/prazo";
import { Button } from "@/components/ui/button";
import { FormularioTrabalho } from "@/components/trabalhos/formulario-trabalho";

export const metadata: Metadata = { title: "Enviar trabalho" };

export default async function PaginaEnviarTrabalho({ params }: PageProps<"/eventos/[slug]/trabalhos">) {
  const { slug } = await params;
  await exigirPerfil(`/eventos/${slug}/trabalhos`);

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, slug, titulo, status, submissoes_abertas, submissoes_ate, submissao_instrucoes, areas_tematicas")
    .eq("slug", slug)
    .maybeSingle();
  if (!evento) notFound();

  const estado = estadoSubmissao(evento, new Date());

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:py-12">
      <Link href={`/eventos/${evento.slug}`} className="text-base text-primary underline-offset-4 hover:underline">
        ← Voltar ao evento
      </Link>

      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Enviar trabalho</h1>
        <p className="text-muted-foreground">{evento.titulo}</p>
      </header>

      {evento.submissoes_ate && (
        <p className="text-base">
          <span className="font-medium">Prazo de envio:</span> até {formatarData(evento.submissoes_ate)} às{" "}
          {formatarHora(evento.submissoes_ate)}
        </p>
      )}

      {evento.submissao_instrucoes && (
        <section aria-labelledby="instrucoes" className="space-y-2 rounded-xl border bg-muted/40 p-4">
          <h2 id="instrucoes" className="font-semibold">Instruções</h2>
          <p className="whitespace-pre-line text-base">{evento.submissao_instrucoes}</p>
        </section>
      )}

      {evento.areas_tematicas.length > 0 && (
        <section aria-labelledby="areas" className="space-y-2">
          <h2 id="areas" className="font-semibold">Áreas temáticas</h2>
          <ul className="list-inside list-disc text-base">
            {evento.areas_tematicas.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {estado.aberto ? (
        <FormularioTrabalho eventoId={evento.id} areas={evento.areas_tematicas} />
      ) : (
        <div role="status" className="space-y-3 rounded-xl bg-warning/15 p-4">
          <p className="text-base font-medium">{estado.mensagem}</p>
          <Button
            variant="outline"
            className="h-11 text-base"
            render={<Link href="/minha-area/trabalhos" />}
            nativeButton={false}
          >
            Ver meus trabalhos
          </Button>
        </div>
      )}
    </div>
  );
}
