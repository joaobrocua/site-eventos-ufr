"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PainelResultado } from "./painel-resultado";
import type { useRegistroPresenca } from "./use-registro-presenca";

export function ModoCodigo({ registro }: { registro: ReturnType<typeof useRegistroPresenca> }) {
  const [texto, setTexto] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    await registro.enviar(texto);
    setTexto("");
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <label htmlFor="codigo-manual" className="text-base font-medium">
          Código do participante
        </label>
        <Input
          id="codigo-manual"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Cole ou digite o código"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 font-mono text-base"
        />
        <Button type="submit" className="h-12 w-full text-base" disabled={registro.enviando || !texto.trim()}>
          {registro.enviando ? "Registrando..." : "Registrar presença"}
        </Button>
      </form>
      <PainelResultado
        resultado={registro.resultado}
        enviando={registro.enviando}
        onContinuar={registro.limpar}
        onIncluir={registro.incluirEregistrar}
      />
    </div>
  );
}
