import { Skeleton } from "@/components/ui/skeleton";

// Página do evento no painel: busca atividades, inscritos, trabalhos,
// certificados e equipe antes de aparecer. Esqueleto do cabeçalho + abas.
export default function CarregandoEvento() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only" role="status">
        Carregando o evento…
      </span>
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-3/4 max-w-xl" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
