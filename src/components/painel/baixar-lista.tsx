"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { baixarArquivo } from "./chamar";

export function BaixarListaBotao({
  href,
  nomePadrao,
  children,
}: {
  href: string;
  nomePadrao: string;
  children: React.ReactNode;
}) {
  const [baixando, setBaixando] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={baixando}
      onClick={async () => {
        setBaixando(true);
        await baixarArquivo(href, nomePadrao);
        setBaixando(false);
      }}
    >
      {baixando ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
      {children}
    </Button>
  );
}
