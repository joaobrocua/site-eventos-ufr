"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { normalizarCodigoCertificado } from "@/lib/inscricao/certificados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormValidar() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const normalizado = normalizarCodigoCertificado(codigo);
    if (!normalizado) {
      setErro("Digite o código que aparece no certificado.");
      return;
    }
    setErro(null);
    setIndo(true);
    router.push(`/certificados/${encodeURIComponent(normalizado)}`);
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="codigo">Código do certificado</Label>
        <Input
          id="codigo"
          name="codigo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={!!erro}
          aria-describedby={erro ? "erro-codigo" : undefined}
          className="h-14 text-center font-mono text-xl tracking-widest uppercase"
        />
        {erro && (
          <p id="erro-codigo" role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}
      </div>
      <Button type="submit" className="h-11 w-full text-base" disabled={indo}>
        {indo ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
        Verificar certificado
      </Button>
    </form>
  );
}
