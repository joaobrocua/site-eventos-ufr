import type { Metadata } from "next";
import Link from "next/link";
import { Award, Download } from "lucide-react";
import { exigirLogin, obterPapel } from "@/lib/auth";
import { formatarCargaHoraria, formatarData, formatarPeriodo } from "@/lib/datas";
import { createClient } from "@/lib/supabase/server";
import { ROTULO_TIPO_CERTIFICADO, type TipoCertificado } from "@/lib/tipos";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Meus certificados" };

export default async function PaginaMeusCertificados() {
  // Equipe (palestrantes/monitores) pode não ter perfil: só exige login.
  const usuario = await exigirLogin("/minha-area/certificados");
  const supabase = await createClient();

  let consulta = supabase
    .from("certificados")
    .select(
      "id, codigo, tipo, funcao, carga_horaria_minutos, emitido_em, revogado_em, revogado_motivo, eventos(titulo, data_inicio, data_fim)",
    )
    .order("emitido_em", { ascending: false });

  // A RLS libera tudo para organizadores; aqui restringimos ao que é deles.
  if (await obterPapel()) {
    const { data: equipe } = await supabase
      .from("equipe_evento")
      .select("id")
      .eq("email", usuario.email.toLowerCase());
    const ids = (equipe ?? []).map((m) => m.id);
    const filtros = [`usuario_id.eq.${usuario.id}`];
    if (ids.length > 0) filtros.push(`equipe_id.in.(${ids.join(",")})`);
    consulta = consulta.or(filtros.join(","));
  }

  const { data, error } = await consulta;
  const certificados = data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Meus certificados</h1>
        <p className="text-muted-foreground">
          Baixe seus certificados em PDF ou compartilhe o código de validação.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          Não foi possível carregar os seus certificados agora. Tente novamente em instantes.
        </p>
      )}

      {!error && certificados.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <Award className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">
            Os certificados aparecem aqui depois que a organização liberar, ao fim do evento.
          </p>
        </div>
      )}

      <ul className="space-y-4">
        {certificados.map((c) => {
          const revogado = !!c.revogado_em;
          return (
            <li key={c.id}>
              <Card className={cn(revogado && "opacity-60")}>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {ROTULO_TIPO_CERTIFICADO[c.tipo as TipoCertificado] ?? c.tipo}
                      {c.funcao ? ` · ${c.funcao}` : ""}
                    </p>
                    <h2 className="text-lg font-semibold">{c.eventos?.titulo ?? "Evento"}</h2>
                    <p className="text-sm text-muted-foreground">
                      {c.eventos ? `${formatarPeriodo(c.eventos.data_inicio, c.eventos.data_fim)} · ` : ""}
                      Carga horária: {formatarCargaHoraria(c.carga_horaria_minutos)}
                    </p>
                    <p className="text-sm">
                      Código: <span className="font-mono font-medium">{c.codigo}</span>
                    </p>
                  </div>
                  {revogado ? (
                    <p className="text-sm font-medium text-destructive">
                      Certificado revogado em {formatarData(c.revogado_em!)}.
                      {c.revogado_motivo ? ` Motivo: ${c.revogado_motivo}` : ""}
                    </p>
                  ) : (
                    <Button
                      className="h-11 text-base"
                      render={<a href={`/certificados/${c.codigo}/pdf`} />}
                      nativeButton={false}
                    >
                      <Download aria-hidden />
                      Baixar PDF
                    </Button>
                  )}
                  <Link
                    href={`/certificados/${c.codigo}`}
                    className="block text-sm text-primary underline underline-offset-4"
                  >
                    Página de validação
                  </Link>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
