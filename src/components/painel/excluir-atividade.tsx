"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { excluirAtividade } from "@/app/painel/eventos/actions";
import { ConfirmarAcao } from "./confirmar-acao";

export function ExcluirAtividadeBotao({
  eventoId,
  atividadeId,
  titulo,
  inscritos,
}: {
  eventoId: string;
  atividadeId: string;
  titulo: string;
  inscritos: number;
}) {
  if (inscritos > 0) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="text-destructive" disabled>
          <Trash2 aria-hidden />
          Excluir
        </Button>
        <p className="text-xs text-muted-foreground">
          Só é possível excluir atividades sem inscritos ({inscritos}{" "}
          {inscritos === 1 ? "inscrito" : "inscritos"}).
        </p>
      </div>
    );
  }
  return (
    <ConfirmarAcao
      gatilho={
        <Button variant="ghost" size="sm" className="text-destructive">
          <Trash2 aria-hidden />
          Excluir
        </Button>
      }
      titulo="Excluir esta atividade?"
      descricao={`"${titulo}" será apagada. Não dá para desfazer.`}
      rotuloConfirmar="Sim, excluir"
      destrutivo
      sucesso="Atividade excluída."
      aoConfirmar={() => excluirAtividade(eventoId, atividadeId)}
    />
  );
}
