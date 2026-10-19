"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Tela amigável usada pelos error.tsx (sem detalhes técnicos para o usuário). */
export function TelaErro({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-warning/15 text-warning">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">Não foi possível carregar esta página</h1>
      <p className="text-muted-foreground">
        Pode ser a conexão com a internet. Tente de novo em alguns segundos.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button className="h-11" onClick={() => retry()}>
          <RotateCw aria-hidden /> Tentar de novo
        </Button>
        <Button variant="outline" className="h-11" render={<Link href="/" />} nativeButton={false}>
          Ir para o início
        </Button>
      </div>
    </div>
  );
}
