import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** Rótulo + controle + texto de ajuda curto embaixo. */
export function Campo({
  id,
  rotulo,
  ajuda,
  children,
}: {
  id: string;
  rotulo: string;
  ajuda?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {ajuda && (
        <p id={`${id}-ajuda`} className="text-xs text-muted-foreground">
          {ajuda}
        </p>
      )}
    </div>
  );
}

export function MensagemErro({ erro }: { erro: string | null }) {
  if (!erro) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {erro}
    </p>
  );
}
