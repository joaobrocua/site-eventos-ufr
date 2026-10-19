import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirOrganizador } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { FormEvento } from "@/components/painel/form-evento";

export const metadata: Metadata = { title: "Criar evento" };

export default async function PaginaNovoEvento() {
  await exigirOrganizador();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/painel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Voltar para meus eventos
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Criar evento</h1>
        <p className="text-muted-foreground">
          Preencha os dados principais. O evento fica como rascunho, escondido do público, até você
          publicar.
        </p>
      </div>
      <Card>
        <CardContent>
          <FormEvento />
        </CardContent>
      </Card>
    </div>
  );
}
