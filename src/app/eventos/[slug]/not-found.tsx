import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EventoNaoEncontrado() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Evento não encontrado</h1>
      <p className="text-muted-foreground">
        Este endereço não corresponde a nenhum evento disponível.
      </p>
      <Button className="h-11 text-base" render={<Link href="/" />} nativeButton={false}>
        Ver todos os eventos
      </Button>
    </div>
  );
}
