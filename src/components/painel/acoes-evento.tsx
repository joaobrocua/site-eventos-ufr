"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { separarDataHoraCuiaba } from "@/lib/datas";
import type { Evento, StatusEvento } from "@/lib/tipos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  excluirEvento,
  mudarStatusEvento,
  salvarInscricoes,
} from "@/app/painel/eventos/actions";
import { Campo, MensagemErro } from "./campo";
import { chamar } from "./chamar";
import { ConfirmarAcao } from "./confirmar-acao";

/** Botões de status com uma explicação simples do que cada um faz. */
export function AcoesStatus({
  evento,
  totalAtividades,
}: {
  evento: Pick<Evento, "id" | "status">;
  totalAtividades: number;
}) {
  const router = useRouter();
  const status = evento.status as StatusEvento;
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function publicar() {
    setErro(null);
    iniciar(async () => {
      const r = await chamar(() => mudarStatusEvento(evento.id, "publicado"));
      if (!r.ok) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success("Evento publicado! Ele já aparece no site.");
      router.refresh();
    });
  }

  const semAtividades = totalAtividades === 0;

  return (
    <div className="space-y-4">
      {status !== "publicado" && (
        <div className="space-y-2">
          <Button className="h-11 px-6 text-base" onClick={publicar} disabled={pendente || semAtividades}>
            {pendente && <Loader2 className="animate-spin" aria-hidden />}
            {status === "encerrado" ? "Publicar novamente" : "Publicar evento"}
          </Button>
          <p className="text-sm text-muted-foreground">
            O evento passa a aparecer no site e as pessoas podem se inscrever.
            {semAtividades && " Para publicar, cadastre pelo menos uma atividade na aba Atividades."}
          </p>
          <MensagemErro erro={erro} />
        </div>
      )}

      {status === "publicado" && (
        <div className="space-y-2">
          <ConfirmarAcao
            gatilho={
              <Button variant="outline" className="h-11 px-6 text-base">
                Encerrar evento
              </Button>
            }
            titulo="Encerrar o evento?"
            descricao="O evento continua visível no site como encerrado, mas ninguém mais consegue se inscrever. As inscrições e presenças são mantidas."
            rotuloConfirmar="Encerrar evento"
            sucesso="Evento encerrado."
            aoConfirmar={() => mudarStatusEvento(evento.id, "encerrado")}
          />
          <p className="text-sm text-muted-foreground">
            Use depois que o evento terminar. As inscrições são fechadas e o site mostra o evento como
            encerrado.
          </p>
        </div>
      )}

      {status !== "rascunho" && (
        <div className="space-y-2">
          <ConfirmarAcao
            gatilho={
              <Button variant="outline" className="h-11 px-6 text-base">
                Voltar para rascunho
              </Button>
            }
            titulo="Voltar para rascunho?"
            descricao="O evento some do site até ser publicado de novo. Quem já está inscrito continua inscrito."
            rotuloConfirmar="Voltar para rascunho"
            sucesso="O evento voltou para rascunho."
            aoConfirmar={() => mudarStatusEvento(evento.id, "rascunho")}
          />
          <p className="text-sm text-muted-foreground">Esconde o evento do site para você ajustar com calma.</p>
        </div>
      )}
    </div>
  );
}

/** Switch "Inscrições abertas" + prazo opcional (data e hora de Cuiabá). */
export function CartaoInscricoes({
  evento,
}: {
  evento: Pick<Evento, "id" | "inscricoes_abertas" | "inscricoes_ate">;
}) {
  const router = useRouter();
  const prazo = evento.inscricoes_ate ? separarDataHoraCuiaba(evento.inscricoes_ate) : null;
  const [abertas, setAbertas] = useState(evento.inscricoes_abertas);
  const [data, setData] = useState(prazo?.data ?? "");
  const [hora, setHora] = useState(prazo?.hora ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await chamar(() => salvarInscricoes(evento.id, { abertas, ate_data: data, ate_hora: hora }));
      if (!r.ok) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success("Configuração das inscrições salva.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="inscricoes-abertas" className="text-base">
            Inscrições abertas
          </Label>
          <p className="text-sm text-muted-foreground">
            Desligue para impedir novas inscrições sem tirar o evento do site.
          </p>
        </div>
        <Switch id="inscricoes-abertas" checked={abertas} onCheckedChange={setAbertas} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="ate_data" rotulo="Prazo para se inscrever: data (opcional)">
          <Input
            id="ate_data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="h-11 text-base"
          />
        </Campo>
        <Campo id="ate_hora" rotulo="Hora (horário de Rondonópolis)" ajuda="Deixe data e hora vazias para não ter prazo.">
          <Input
            id="ate_hora"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="h-11 text-base"
          />
        </Campo>
      </div>

      <MensagemErro erro={erro} />
      <Button className="h-11 px-6 text-base" onClick={salvar} disabled={pendente}>
        {pendente && <Loader2 className="animate-spin" aria-hidden />}
        Salvar inscrições
      </Button>
    </div>
  );
}

export function ExcluirEventoBotao({
  id,
  titulo,
  inscritos,
  trabalhos,
}: {
  id: string;
  titulo: string;
  inscritos: number;
  trabalhos: number;
}) {
  const router = useRouter();
  if (inscritos > 0 || trabalhos > 0) {
    return (
      <div className="space-y-2">
        <Button variant="destructive" className="h-11 px-6 text-base" disabled>
          <Trash2 aria-hidden />
          Excluir evento
        </Button>
        <p className="text-sm text-muted-foreground">
          Só é possível excluir eventos sem inscritos e sem trabalhos. Este tem{" "}
          {[
            inscritos > 0 && `${inscritos} ${inscritos === 1 ? "inscrito" : "inscritos"}`,
            trabalhos > 0 && `${trabalhos} ${trabalhos === 1 ? "trabalho" : "trabalhos"}`,
          ]
            .filter(Boolean)
            .join(" e ")}
          .
        </p>
      </div>
    );
  }
  return (
    <ConfirmarAcao
      gatilho={
        <Button variant="destructive" className="h-11 px-6 text-base">
          <Trash2 aria-hidden />
          Excluir evento
        </Button>
      }
      titulo="Excluir este evento?"
      descricao={`"${titulo}" e todas as suas atividades serão apagados. Não dá para desfazer.`}
      rotuloConfirmar="Sim, excluir"
      destrutivo
      sucesso="Evento excluído."
      aoConfirmar={() => excluirEvento(id)}
      aposSucesso={() => {
        router.replace("/painel");
        router.refresh();
      }}
    />
  );
}
