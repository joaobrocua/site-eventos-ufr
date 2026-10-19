import Link from "next/link";
import { CalendarPlus, Plus } from "lucide-react";
import { exigirOrganizador } from "@/lib/auth";
import { formatarPeriodo } from "@/lib/datas";
import { createClient } from "@/lib/supabase/server";
import { ROTULO_STATUS_EVENTO, type StatusEvento } from "@/lib/tipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MensagemErro } from "@/components/painel/campo";

export default async function PaginaPainel() {
  await exigirOrganizador();
  const supabase = await createClient();
  // O embed com filtro conta só as inscrições confirmadas de cada evento.
  const { data, error } = await supabase
    .from("eventos")
    .select("id, titulo, data_inicio, data_fim, status, atividades(count), inscricoes(count)")
    .eq("inscricoes.status", "confirmada")
    .order("data_inicio", { ascending: false });

  const eventos = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Meus eventos</h1>
          <p className="text-muted-foreground">Crie e acompanhe os eventos do curso.</p>
        </div>
        <Button className="h-11 px-5 text-base" render={<Link href="/painel/eventos/novo" />} nativeButton={false}>
          <Plus aria-hidden />
          Criar evento
        </Button>
      </div>

      {error && <MensagemErro erro="Não foi possível carregar os eventos. Atualize a página." />}

      {!error && eventos.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CalendarPlus className="size-10 text-primary" aria-hidden />
            <div className="space-y-1">
              <p className="text-lg font-medium">Você ainda não criou nenhum evento</p>
              <p className="max-w-md text-muted-foreground">
                O primeiro passo é criar o evento com título, local e datas. Depois você cadastra as
                atividades e publica para abrir as inscrições.
              </p>
            </div>
            <Button className="h-11 px-6 text-base" render={<Link href="/painel/eventos/novo" />} nativeButton={false}>
              Criar meu primeiro evento
            </Button>
          </CardContent>
        </Card>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {eventos.map((e) => {
          const atividades = e.atividades[0]?.count ?? 0;
          const inscritos = e.inscricoes[0]?.count ?? 0;
          return (
            <li key={e.id}>
              <Link
                href={`/painel/eventos/${e.id}`}
                className="block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card className="h-full transition-colors hover:bg-muted/40">
                  <CardContent className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base leading-snug font-semibold">{e.titulo}</h2>
                      <Badge variant={e.status === "publicado" ? "default" : "secondary"}>
                        {ROTULO_STATUS_EVENTO[e.status as StatusEvento] ?? e.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatarPeriodo(e.data_inicio, e.data_fim)}</p>
                    <p className="mt-auto text-sm">
                      <span className="font-medium">{atividades}</span>{" "}
                      {atividades === 1 ? "atividade" : "atividades"} ·{" "}
                      <span className="font-medium">{inscritos}</span>{" "}
                      {inscritos === 1 ? "inscrito" : "inscritos"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
