"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { separarDataHoraCuiaba } from "@/lib/datas";
import type { Evento } from "@/lib/tipos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { salvarConfigTrabalhos } from "@/app/painel/eventos/trabalhos-actions";
import { Campo, MensagemErro } from "./campo";
import { chamar } from "./chamar";

const MAX_AREAS = 30;

export function ConfigTrabalhos({
  evento,
}: {
  evento: Pick<
    Evento,
    "id" | "slug" | "submissoes_abertas" | "submissoes_ate" | "submissao_instrucoes" | "areas_tematicas"
  >;
}) {
  const router = useRouter();
  const prazo = evento.submissoes_ate ? separarDataHoraCuiaba(evento.submissoes_ate) : null;
  const [abertas, setAbertas] = useState(evento.submissoes_abertas);
  const [data, setData] = useState(prazo?.data ?? "");
  const [hora, setHora] = useState(prazo?.hora ?? "");
  const [instrucoes, setInstrucoes] = useState(evento.submissao_instrucoes ?? "");
  const [areas, setAreas] = useState<string[]>(evento.areas_tematicas);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await chamar(() =>
        salvarConfigTrabalhos(evento.id, { abertas, ate_data: data, ate_hora: hora, instrucoes, areas }),
      );
      if (!r.ok) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success("Configuração dos trabalhos salva.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="receber-trabalhos" className="text-base">
            Receber trabalhos
          </Label>
          <p className="text-sm text-muted-foreground">
            Quando ligado, os participantes enviam resumo e PDF pela página pública:{" "}
            <strong>/eventos/{evento.slug}/trabalhos</strong>
          </p>
        </div>
        <Switch id="receber-trabalhos" checked={abertas} onCheckedChange={setAbertas} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="sub_data" rotulo="Prazo para enviar: data (opcional)">
          <Input id="sub_data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-11 text-base" />
        </Campo>
        <Campo id="sub_hora" rotulo="Hora (horário de Rondonópolis)" ajuda="Deixe data e hora vazias para não ter prazo.">
          <Input id="sub_hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="h-11 text-base" />
        </Campo>
      </div>

      <Campo id="sub_instrucoes" rotulo="Instruções para os autores" ajuda="Normas, formato do PDF, tamanho do resumo etc. (até 5000 letras).">
        <Textarea
          id="sub_instrucoes"
          rows={5}
          maxLength={5000}
          value={instrucoes}
          onChange={(e) => setInstrucoes(e.target.value)}
          className="text-base"
        />
      </Campo>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Áreas temáticas</legend>
        <p className="text-xs text-muted-foreground">
          O autor escolhe uma delas ao enviar. Até {MAX_AREAS} áreas, de no máximo 120 letras cada.
        </p>
        <ul className="space-y-2">
          {areas.map((a, idx) => (
            <li key={idx} className="flex gap-2">
              <Input
                aria-label={`Área temática ${idx + 1}`}
                value={a}
                maxLength={120}
                onChange={(e) => setAreas(areas.map((x, i) => (i === idx ? e.target.value : x)))}
                className="h-11 text-base"
              />
              <Button
                type="button"
                variant="outline"
                className="size-11"
                aria-label={`Remover área ${idx + 1}`}
                onClick={() => setAreas(areas.filter((_, i) => i !== idx))}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          disabled={areas.length >= MAX_AREAS}
          onClick={() => setAreas([...areas, ""])}
        >
          <Plus aria-hidden />
          Adicionar área
        </Button>
      </fieldset>

      <MensagemErro erro={erro} />
      <Button className="h-11 px-6 text-base" onClick={salvar} disabled={pendente}>
        {pendente && <Loader2 className="animate-spin" aria-hidden />}
        Salvar configuração
      </Button>
    </div>
  );
}
