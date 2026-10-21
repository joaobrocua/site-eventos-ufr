import type { Metadata } from "next";
import Link from "next/link";
import { Clock, FileText, MapPin } from "lucide-react";
import { exigirPerfil } from "@/lib/auth";
import { formatarDiaLongo, formatarIntervaloHoras } from "@/lib/datas";
import { createClient } from "@/lib/supabase/server";
import {
  ROTULO_MODALIDADE,
  ROTULO_STATUS_TRABALHO,
  type ModalidadeTrabalho,
  type StatusTrabalho,
} from "@/lib/tipos";
import { acoesPermitidas } from "@/lib/trabalhos/permissoes";
import { estadoSubmissao } from "@/lib/trabalhos/prazo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AcoesDoTrabalho } from "@/components/trabalhos/acoes-trabalho";

export const metadata: Metadata = { title: "Meus trabalhos" };

const VARIANTE: Record<StatusTrabalho, "default" | "secondary" | "destructive" | "outline"> = {
  submetido: "secondary",
  aprovado: "default",
  reprovado: "destructive",
  retirado: "outline",
};

export default async function PaginaMeusTrabalhos() {
  const perfil = await exigirPerfil("/minha-area/trabalhos");
  const supabase = await createClient();

  // A RLS deixa organizadores verem tudo; por isso filtramos pelo dono.
  const { data, error } = await supabase
    .from("trabalhos")
    .select(
      "*, eventos(titulo, slug, status, submissoes_abertas, submissoes_ate), atividades(titulo, inicio, fim, local)",
    )
    .eq("autor_id", perfil.id)
    .order("criado_em", { ascending: false });

  const agora = new Date();
  const grupos = new Map<string, { titulo: string; slug: string | null; trabalhos: NonNullable<typeof data> }>();
  for (const t of data ?? []) {
    const g = grupos.get(t.evento_id) ?? {
      titulo: t.eventos?.titulo ?? "Evento",
      slug: t.eventos?.slug ?? null,
      trabalhos: [],
    };
    g.trabalhos.push(t);
    grupos.set(t.evento_id, g);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:py-12">
      <header className="space-y-2">
        <Link href="/minha-area" className="text-base text-primary underline-offset-4 hover:underline">
          ← Minha área
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Meus trabalhos</h1>
        <p className="text-muted-foreground">
          Acompanhe a situação dos trabalhos que você enviou. O resultado da avaliação também chega por e-mail.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          Não foi possível carregar os seus trabalhos agora. Tente novamente em instantes.
        </p>
      )}

      {!error && grupos.size === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <FileText className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Você ainda não enviou nenhum trabalho</p>
          <Button className="h-11 text-base" render={<Link href="/" />} nativeButton={false}>
            Ver eventos
          </Button>
        </div>
      )}

      {[...grupos.entries()].map(([eventoId, g]) => (
        <section key={eventoId} aria-labelledby={`evento-${eventoId}`} className="space-y-3">
          <h2 id={`evento-${eventoId}`} className="text-xl font-semibold">
            {g.slug ? (
              <Link href={`/eventos/${g.slug}`} className="hover:underline">
                {g.titulo}
              </Link>
            ) : (
              g.titulo
            )}
          </h2>

          {g.trabalhos.map((t) => {
            const status = t.status as StatusTrabalho;
            const prazoAberto = t.eventos ? estadoSubmissao(t.eventos, agora).aberto : false;
            const acoes = acoesPermitidas(t, prazoAberto, t.eventos?.status === "publicado");
            const sessao = status === "aprovado" ? t.atividades : null;
            const faltaPdf = status === "submetido" && !t.arquivo_path;

            return (
              <Card key={t.id} className={status === "retirado" ? "opacity-70" : undefined}>
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={VARIANTE[status] ?? "outline"}>
                      {ROTULO_STATUS_TRABALHO[status] ?? t.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {ROTULO_MODALIDADE[t.modalidade as ModalidadeTrabalho] ?? t.modalidade}
                      {t.area ? ` · ${t.area}` : ""}
                    </span>
                  </div>
                  <CardTitle className="text-lg">{t.titulo}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Array.isArray(t.coautores) && t.coautores.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Coautores: {t.coautores.join(", ")}
                    </p>
                  )}

                  {faltaPdf ? (
                    <p role="status" className="rounded-lg bg-warning/15 p-3 text-base font-medium">
                      Falta enviar o PDF.
                      {acoes.reenviarPdf ? " Use o botão abaixo para enviar." : " O prazo de envio já terminou."}
                    </p>
                  ) : (
                    t.arquivo_path && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="size-4" aria-hidden /> PDF enviado
                      </p>
                    )
                  )}

                  {t.parecer && (
                    <div className="space-y-1 rounded-lg border bg-muted/40 p-3">
                      <p className="text-sm font-medium">Comentário da organização</p>
                      <p className="whitespace-pre-line text-base">{t.parecer}</p>
                    </div>
                  )}

                  {sessao && (
                    <div className="space-y-1 rounded-lg border p-3">
                      <p className="font-medium">Sua apresentação: {sessao.titulo}</p>
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="size-4 shrink-0" aria-hidden />
                        <span>
                          <span className="inline-block first-letter:uppercase">{formatarDiaLongo(sessao.inicio)}</span>
                          , {formatarIntervaloHoras(sessao.inicio, sessao.fim)}
                        </span>
                      </p>
                      {sessao.local && (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="size-4 shrink-0" aria-hidden />
                          {sessao.local}
                        </p>
                      )}
                    </div>
                  )}
                  {status === "aprovado" && !sessao && (
                    <p className="text-sm text-muted-foreground">
                      O dia e o horário da apresentação serão informados em breve.
                    </p>
                  )}

                  <AcoesDoTrabalho trabalhoId={t.id} titulo={t.titulo} acoes={acoes} />
                </CardContent>
              </Card>
            );
          })}
        </section>
      ))}
    </div>
  );
}
