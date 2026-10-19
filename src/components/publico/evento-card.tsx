import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { formatarPeriodo } from "@/lib/datas";
import type { Evento } from "@/lib/tipos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  evento: Pick<Evento, "slug" | "titulo" | "resumo" | "local" | "data_inicio" | "data_fim">;
  anterior?: boolean;
};

export function EventoCard({ evento, anterior = false }: Props) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg leading-snug">{evento.titulo}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0" aria-hidden />
            <span>{formatarPeriodo(evento.data_inicio, evento.data_fim)}</span>
          </li>
          {evento.local && (
            <li className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" aria-hidden />
              <span>{evento.local}</span>
            </li>
          )}
        </ul>
        {evento.resumo && <p className="text-base">{evento.resumo}</p>}
      </CardContent>
      <CardFooter>
        <Button
          className="h-11 w-full text-base sm:w-auto"
          variant={anterior ? "outline" : "default"}
          render={<Link href={`/eventos/${evento.slug}`} />}
          nativeButton={false}
        >
          Ver programação
          <ArrowRight aria-hidden />
        </Button>
      </CardFooter>
    </Card>
  );
}
