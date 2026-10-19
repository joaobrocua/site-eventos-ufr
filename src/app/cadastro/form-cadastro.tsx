"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Perfil } from "@/lib/tipos";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarPerfil } from "./actions";

export function FormCadastro({
  email,
  perfil,
  destino,
}: {
  email: string;
  perfil: Perfil | null;
  destino: string;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(formData: FormData) {
    setErro(null);
    iniciar(async () => {
      let r: Awaited<ReturnType<typeof salvarPerfil>>;
      try {
        r = await salvarPerfil(Object.fromEntries(formData));
      } catch {
        setErro("Sem conexão. Verifique a internet e tente novamente.");
        return;
      }
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      toast.success("Cadastro salvo!");
      router.replace(destino);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent>
        <form action={enviar} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={email} disabled className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nome_completo">Nome completo *</Label>
            <Input
              id="nome_completo"
              name="nome_completo"
              required
              autoComplete="name"
              defaultValue={perfil?.nome_completo ?? ""}
              className="h-11 text-base"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rga">RGA (se for aluno da UFR)</Label>
              <Input
                id="rga"
                name="rga"
                inputMode="numeric"
                defaultValue={perfil?.rga ?? ""}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Celular com DDD</Label>
              <Input
                id="telefone"
                name="telefone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(66) 99999-9999"
                defaultValue={perfil?.telefone ?? ""}
                className="h-11 text-base"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="curso">Curso</Label>
            <Input
              id="curso"
              name="curso"
              placeholder="Ex.: Engenharia de Minas"
              defaultValue={perfil?.curso ?? ""}
              className="h-11 text-base"
            />
          </div>
          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Usamos estes dados só para inscrições, controle de presença e certificados dos eventos
            da UFR.
          </p>
          <Button type="submit" className="h-11 w-full text-base" disabled={pendente}>
            {pendente && <Loader2 className="animate-spin" aria-hidden />}
            Salvar e continuar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
