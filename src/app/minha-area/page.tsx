import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { CalendarSearch, CheckCircle2, Clock, MapPin } from "lucide-react";
import { exigirPerfil } from "@/lib/auth";
import { formatarDiaLongo, formatarIntervaloHoras, formatarPeriodo } from "@/lib/datas";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Minha área" };

/** SVG do QR code. O conteúdo é exatamente o código da inscrição (texto puro). */
function qrSvg(codigo: string) {
  return QRCode.toString(codigo, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}

export default async function PaginaMinhaArea() {
  const perfil = await exigirPerfil("/minha-area");
  const supabase = await createClient();

  // A RLS deixa organizadores verem tudo; por isso filtramos pelo dono.
  const { data, error } = await supabase
    .from("inscricoes")
    .select(
      "id, codigo, eventos(id, slug, titulo, data_inicio, data_fim, local), inscricoes_atividades(status, presente_em, atividades(id, titulo, inicio, fim, local))",
    )
    .eq("usuario_id", perfil.id)
    .eq("status", "confirmada")
    .order("criado_em", { ascending: false });

  const inscricoes = await Promise.all(
    (data ?? []).map(async (i) => ({ ...i, svg: await qrSvg(i.codigo) })),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Olá, {perfil.nome_completo.split(" ")[0]}!
        </h1>
        <p className="text-muted-foreground">Aqui estão as suas inscrições e o seu QR code.</p>
        <Button
          variant="outline"
          className="h-11 text-base"
          render={<Link href="/cadastro?editar=1&proximo=/minha-area" />}
          nativeButton={false}
        >
          Editar meus dados
        </Button>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          Não foi possível carregar as suas inscrições agora. Tente novamente em instantes.
        </p>
      )}

      {!error && inscricoes.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <CalendarSearch className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Você ainda não está inscrito em nenhum evento</p>
          <Button className="h-11 text-base" render={<Link href="/" />} nativeButton={false}>
            Ver eventos
          </Button>
        </div>
      )}

      {inscricoes.map((i) => {
        const evento = i.eventos;
        const atividades = (i.inscricoes_atividades ?? [])
          .filter((x) => x.status === "confirmada" && x.atividades)
          .map((x) => ({ ...x, atividade: x.atividades! }))
          .sort((a, b) => a.atividade.inicio.localeCompare(b.atividade.inicio));

        return (
          <Card key={i.id}>
            <CardHeader>
              <CardTitle className="text-xl">
                {evento ? (
                  <Link href={`/eventos/${evento.slug}`} className="hover:underline">
                    {evento.titulo}
                  </Link>
                ) : (
                  "Evento"
                )}
              </CardTitle>
              {evento && (
                <p className="text-sm text-muted-foreground">
                  {formatarPeriodo(evento.data_inicio, evento.data_fim)}
                  {evento.local ? ` · ${evento.local}` : ""}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-3 rounded-xl bg-muted/50 p-4">
                <div
                  role="img"
                  aria-label={`QR code da inscrição em ${evento?.titulo ?? "evento"}`}
                  className="w-full max-w-72 rounded-lg bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: i.svg }}
                />
                <p className="text-center font-medium">
                  Mostre este QR code na entrada de cada atividade.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="font-semibold">Minhas atividades</h2>
                {atividades.length === 0 ? (
                  <p className="text-muted-foreground">
                    Você ainda não escolheu atividades.{" "}
                    {evento && (
                      <Link href={`/eventos/${evento.slug}`} className="text-primary underline underline-offset-4">
                        Escolher agora
                      </Link>
                    )}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {atividades.map(({ atividade: a, presente_em }) => (
                      <li key={a.id} className="space-y-1 rounded-lg border p-3">
                        <p className="font-medium">{a.titulo}</p>
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="size-4 shrink-0" aria-hidden />
                          <span>
                            <span className="first-letter:uppercase inline-block">
                              {formatarDiaLongo(a.inicio)}
                            </span>
                            , {formatarIntervaloHoras(a.inicio, a.fim)}
                          </span>
                        </p>
                        {a.local && (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="size-4 shrink-0" aria-hidden />
                            {a.local}
                          </p>
                        )}
                        {presente_em ? (
                          <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                            <CheckCircle2 className="size-4" aria-hidden />
                            Presença registrada
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Presença ainda não registrada</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
