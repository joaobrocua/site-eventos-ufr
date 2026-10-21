"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatarPeriodo, separarDataHoraCuiaba } from "@/lib/datas";
import {
  ROTULO_TIPO_ATIVIDADE,
  TIPOS_ATIVIDADE,
  type Atividade,
  type TipoAtividade,
} from "@/lib/tipos";
import { foraDoPeriodo } from "@/lib/painel/periodo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { salvarAtividade } from "@/app/painel/eventos/actions";
import { Campo, MensagemErro } from "./campo";
import { chamar } from "./chamar";

const ITENS_TIPO = TIPOS_ATIVIDADE.map((t) => ({ value: t, label: ROTULO_TIPO_ATIVIDADE[t] }));

/** Minutos entre duas horas "HH:MM" (0 se o intervalo for inválido). */
function minutosEntre(inicio: string, fim: string) {
  const re = /^(\d{2}):(\d{2})$/;
  const a = re.exec(inicio);
  const b = re.exec(fim);
  if (!a || !b) return 0;
  const dif = Number(b[1]) * 60 + Number(b[2]) - (Number(a[1]) * 60 + Number(a[2]));
  return dif > 0 ? dif : 0;
}

/** Botão (gatilho) que abre o formulário de criar/editar atividade. */
export function DialogAtividade({
  eventoId,
  atividade,
  dataPadrao,
  dataFim,
  trabalhos = 0,
  gatilho,
}: {
  eventoId: string;
  atividade?: Atividade;
  /** Dia sugerido ao criar (primeiro dia do evento), "AAAA-MM-DD". */
  dataPadrao: string;
  /** Último dia do evento, para avisar sobre datas fora do período. */
  dataFim: string;
  /** Trabalhos vinculados a esta atividade (sessão): impedem trocar o tipo. */
  trabalhos?: number;
  gatilho: ReactElement;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={gatilho} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{atividade ? "Editar atividade" : "Nova atividade"}</DialogTitle>
          <DialogDescription>
            Uma palestra, minicurso, oficina... Os horários são os de Rondonópolis.
          </DialogDescription>
        </DialogHeader>
        <FormAtividade
          eventoId={eventoId}
          atividade={atividade}
          dataPadrao={dataPadrao}
          dataFim={dataFim}
          trabalhos={trabalhos}
          aoSalvar={() => setAberto(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormAtividade({
  eventoId,
  atividade,
  dataPadrao,
  dataFim,
  trabalhos,
  aoSalvar,
}: {
  eventoId: string;
  atividade?: Atividade;
  dataPadrao: string;
  dataFim: string;
  trabalhos: number;
  aoSalvar: () => void;
}) {
  const router = useRouter();
  const inicio = atividade ? separarDataHoraCuiaba(atividade.inicio) : null;
  const fim = atividade ? separarDataHoraCuiaba(atividade.fim) : null;
  const duracaoInicial = inicio && fim ? minutosEntre(inicio.hora, fim.hora) : 0;

  const [tipo, setTipo] = useState<string>(atividade?.tipo ?? "palestra");
  const [horaInicio, setHoraInicio] = useState(inicio?.hora ?? "");
  const [horaFim, setHoraFim] = useState(fim?.hora ?? "");
  const [ilimitadas, setIlimitadas] = useState(atividade ? atividade.vagas === null : false);
  // Enquanto a carga horária for igual à duração, ela acompanha os horários.
  const [cargaManual, setCargaManual] = useState(
    !!atividade && atividade.carga_horaria_minutos !== duracaoInicial,
  );
  const [carga, setCarga] = useState(() => {
    const total = atividade?.carga_horaria_minutos ?? 0;
    return { horas: String(Math.floor(total / 60)), minutos: String(total % 60) };
  });
  const [dia, setDia] = useState(inicio?.data ?? dataPadrao);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function mudarHorario(novoInicio: string, novoFim: string) {
    setHoraInicio(novoInicio);
    setHoraFim(novoFim);
    if (!cargaManual) {
      const total = minutosEntre(novoInicio, novoFim);
      setCarga({ horas: String(Math.floor(total / 60)), minutos: String(total % 60) });
    }
  }

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const entrada = {
      ...Object.fromEntries(new FormData(e.currentTarget)),
      tipo,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      vagas_ilimitadas: ilimitadas,
      carga_horas: carga.horas,
      carga_minutos: carga.minutos,
    };
    iniciar(async () => {
      const r = await chamar(() => salvarAtividade(eventoId, atividade?.id ?? null, entrada));
      if (!r.ok) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success(atividade ? "Atividade atualizada." : "Atividade adicionada.");
      aoSalvar();
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo id="at-titulo" rotulo="Título *">
        <Input
          id="at-titulo"
          name="titulo"
          required
          maxLength={150}
          defaultValue={atividade?.titulo ?? ""}
          className="h-11 text-base"
        />
      </Campo>

      <div className="space-y-2">
        <Label htmlFor="at-tipo">Tipo *</Label>
        <Select items={ITENS_TIPO} value={tipo} disabled={trabalhos > 0 && atividade?.tipo === "apresentacao"} onValueChange={(v) => v && setTipo(v as TipoAtividade)}>
          <SelectTrigger id="at-tipo" className="h-11 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ITENS_TIPO.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {trabalhos > 0 && atividade?.tipo === "apresentacao" && (
          <p className="text-xs text-muted-foreground">
            O tipo não pode mudar enquanto houver trabalhos nesta sessão ({trabalhos}). Desvincule-os na aba Trabalhos.
          </p>
        )}
      </div>

      <Campo id="at-palestrantes" rotulo="Palestrante(s)" ajuda="Separe os nomes por vírgula.">
        <Input
          id="at-palestrantes"
          name="palestrantes"
          maxLength={300}
          defaultValue={atividade?.palestrantes ?? ""}
          className="h-11 text-base"
        />
      </Campo>

      <Campo id="at-descricao" rotulo="Descrição">
        <Textarea
          id="at-descricao"
          name="descricao"
          rows={3}
          maxLength={5000}
          defaultValue={atividade?.descricao ?? ""}
          className="text-base"
        />
      </Campo>

      <Campo id="at-local" rotulo="Local" ajuda="Deixe vazio para usar o local do evento.">
        <Input
          id="at-local"
          name="local"
          maxLength={200}
          defaultValue={atividade?.local ?? ""}
          className="h-11 text-base"
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id="at-data" rotulo="Dia *">
          <Input
            id="at-data"
            name="data"
            type="date"
            required
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="h-11 text-base"
          />
        </Campo>
        <Campo id="at-inicio" rotulo="Começa às *">
          <Input
            id="at-inicio"
            type="time"
            required
            value={horaInicio}
            onChange={(e) => mudarHorario(e.target.value, horaFim)}
            className="h-11 text-base"
          />
        </Campo>
        <Campo id="at-fim" rotulo="Termina às *">
          <Input
            id="at-fim"
            type="time"
            required
            value={horaFim}
            onChange={(e) => mudarHorario(horaInicio, e.target.value)}
            className="h-11 text-base"
          />
        </Campo>
      </div>
      {foraDoPeriodo(dia, dataPadrao, dataFim) && (
        <p className="text-sm text-warning" role="status">
          Atenção: este dia está fora do período do evento ({formatarPeriodo(dataPadrao, dataFim)}). Confira o ano e o dia.
        </p>
      )}

      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="at-ilimitadas">Vagas ilimitadas</Label>
          <Switch id="at-ilimitadas" checked={ilimitadas} onCheckedChange={setIlimitadas} />
        </div>
        {!ilimitadas && (
          <Campo id="at-vagas" rotulo="Número de vagas">
            <Input
              id="at-vagas"
              name="vagas"
              type="number"
              inputMode="numeric"
              min={1}
              required
              defaultValue={atividade?.vagas ?? ""}
              className="h-11 text-base"
            />
          </Campo>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Carga horária (para o certificado)</legend>
        <div className="grid grid-cols-2 gap-4">
          <Campo id="at-horas" rotulo="Horas">
            <Input
              id="at-horas"
              type="number"
              inputMode="numeric"
              min={0}
              value={carga.horas}
              onChange={(e) => {
                setCargaManual(true);
                setCarga({ ...carga, horas: e.target.value });
              }}
              className="h-11 text-base"
            />
          </Campo>
          <Campo id="at-minutos" rotulo="Minutos">
            <Input
              id="at-minutos"
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              value={carga.minutos}
              onChange={(e) => {
                setCargaManual(true);
                setCarga({ ...carga, minutos: e.target.value });
              }}
              className="h-11 text-base"
            />
          </Campo>
        </div>
        <p className="text-xs text-muted-foreground">
          Calculada pelos horários; mude só se a carga for diferente da duração.
        </p>
      </fieldset>

      <MensagemErro erro={erro} />
      <Button type="submit" className="h-11 w-full text-base" disabled={pendente}>
        {pendente && <Loader2 className="animate-spin" aria-hidden />}
        {atividade ? "Salvar atividade" : "Adicionar atividade"}
      </Button>
    </form>
  );
}
