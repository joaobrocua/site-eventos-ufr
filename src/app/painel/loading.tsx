import { Skeleton } from "@/components/ui/skeleton";

// Enquanto o painel carrega: esqueleto da lista de eventos.
export default function CarregandoPainel() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only" role="status">
        Carregando…
      </span>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
