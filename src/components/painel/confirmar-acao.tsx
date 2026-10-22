"use client";

import { useState, useTransition, type ReactElement, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ResultadoAcao } from "@/lib/erros";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { MensagemErro } from "./campo";
import { chamar } from "./chamar";

/**
 * Botão que pede confirmação antes de executar uma ação (excluir, encerrar...).
 * `gatilho` é o botão que abre a confirmação.
 */
export function ConfirmarAcao({
  gatilho,
  titulo,
  descricao,
  rotuloConfirmar,
  destrutivo = false,
  sucesso,
  aoConfirmar,
  aposSucesso,
}: {
  gatilho: ReactElement;
  titulo: string;
  descricao: ReactNode;
  rotuloConfirmar: string;
  destrutivo?: boolean;
  /** Vazio = a própria ação mostra o aviso de sucesso. */
  sucesso: string;
  aoConfirmar: () => Promise<ResultadoAcao>;
  /** Padrão: atualiza a página. Use para redirecionar (ex.: depois de excluir o evento). */
  aposSucesso?: () => void;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    setErro(null);
    iniciar(async () => {
      const r = await chamar(aoConfirmar);
      if (!r.ok) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      if (sucesso) toast.success(sucesso);
      setAberto(false);
      if (aposSucesso) aposSucesso();
      else router.refresh();
    });
  }

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(v) => {
        // Não fecha enquanto a ação está em andamento.
        if (pendente) return;
        setAberto(v);
        if (v) setErro(null);
      }}
    >
      <AlertDialogTrigger render={gatilho} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <MensagemErro erro={erro} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
          <Button
            variant={destrutivo ? "destructive" : "default"}
            onClick={confirmar}
            disabled={pendente}
          >
            {pendente && <Loader2 className="animate-spin" aria-hidden />}
            {rotuloConfirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
