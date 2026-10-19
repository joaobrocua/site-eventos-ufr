import { CalendarX } from "lucide-react";
import { chaveDoDia } from "@/lib/datas";
import { eventoAnterior } from "@/lib/inscricao/regras";
import { createClient } from "@/lib/supabase/server";
import { EventoCard } from "@/components/publico/evento-card";

export default async function PaginaInicial() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .select("id, slug, titulo, resumo, local, data_inicio, data_fim, status")
    .in("status", ["publicado", "encerrado"])
    .order("data_inicio", { ascending: true });

  const hoje = chaveDoDia(new Date());
  const eventos = data ?? [];
  const proximos = eventos.filter((e) => !eventoAnterior(e, hoje));
  const anteriores = eventos.filter((e) => eventoAnterior(e, hoje)).reverse();

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:py-12">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Eventos da UFR em Rondonópolis
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Veja a programação, escolha as atividades que quer assistir e faça sua inscrição em
          poucos minutos.
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          Não foi possível carregar os eventos agora. Tente novamente em instantes.
        </p>
      )}

      <section aria-labelledby="titulo-proximos" className="space-y-4">
        <h2 id="titulo-proximos" className="text-xl font-semibold">
          Próximos eventos
        </h2>
        {proximos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
            <CalendarX className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Nenhum evento aberto no momento</p>
            <p className="text-muted-foreground">Volte em breve: novos eventos aparecem aqui.</p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {proximos.map((e) => (
              <li key={e.id}>
                <EventoCard evento={e} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {anteriores.length > 0 && (
        <section aria-labelledby="titulo-anteriores" className="space-y-4">
          <h2 id="titulo-anteriores" className="text-xl font-semibold">
            Eventos anteriores
          </h2>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {anteriores.map((e) => (
              <li key={e.id}>
                <EventoCard evento={e} anterior />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
