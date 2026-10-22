"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatarCargaHoraria } from "@/lib/datas";
import { ROTULO_TIPO_CERTIFICADO, type MembroEquipe } from "@/lib/tipos";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { excluirMembroEquipe, salvarMembroEquipe } from "@/app/painel/eventos/certificados-actions";
import { Campo, MensagemErro } from "./campo";
import { chamar } from "./chamar";
import { ConfirmarAcao } from "./confirmar-acao";

export type AtividadeResumo = { id: string; titulo: string; carga_horaria_minutos: number };

const ITENS_TIPO = [
  { value: "palestrante", label: ROTULO_TIPO_CERTIFICADO.palestrante },
  { value: "organizacao", label: ROTULO_TIPO_CERTIFICADO.organizacao },
];
const SEM_ATIVIDADE = "nenhuma";

export function EquipeEvento({
  eventoId,
  equipe,
  atividades,
}: {
  eventoId: string;
  equipe: MembroEquipe[];
  atividades: AtividadeResumo[];
}) {
  const router = useRouter();
  const titulo = (id: string | null) => atividades.find((a) => a.id === id)?.titulo ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Palestrantes, ministrantes, monitores e organizadores recebem certificado próprio.
        </p>
        <DialogMembro
          eventoId={eventoId}
          atividades={atividades}
          gatilho={
            <Button className="h-11 px-5 text-base">
              <Plus aria-hidden />
              Adicionar pessoa
            </Button>
          }
        />
      </div>

      {equipe.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Nenhuma pessoa na equipe ainda.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {equipe.map((m) => (
            <li key={m.id}>
              <Card size="sm">
                <CardContent className="space-y-2">
                  <div className="space-y-0.5">
                    <p className="text-base font-medium">{m.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {m.funcao} · {ROTULO_TIPO_CERTIFICADO[m.tipo as "palestrante" | "organizacao"] ?? m.tipo} ·{" "}
                      {formatarCargaHoraria(m.carga_horaria_minutos)}
                      {titulo(m.atividade_id) ? ` · ${titulo(m.atividade_id)}` : ""}
                    </p>
                    {m.email && <p className="text-sm text-muted-foreground">{m.email}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <DialogMembro
                      eventoId={eventoId}
                      membro={m}
                      atividades={atividades}
                      gatilho={
                        <Button variant="outline" size="sm">
                          <Pencil aria-hidden />
                          Editar
                        </Button>
                      }
                    />
                    <ConfirmarAcao
                      gatilho={
                        <Button variant="ghost" size="sm" className="text-destructive">
                          <Trash2 aria-hidden />
                          Excluir
                        </Button>
                      }
                      titulo="Remover da equipe?"
                      descricao={`${m.nome} sai da lista. O certificado dessa pessoa, se já emitido, será revogado imediatamente.`}
                      rotuloConfirmar="Sim, remover"
                      destrutivo
                      sucesso="Pessoa removida da equipe."
                      aoConfirmar={() => excluirMembroEquipe(eventoId, m.id)}
                      aposSucesso={() => router.refresh()}
                    />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DialogMembro({
  eventoId,
  membro,
  atividades,
  gatilho,
}: {
  eventoId: string;
  membro?: MembroEquipe;
  atividades: AtividadeResumo[];
  gatilho: ReactElement;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={gatilho} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{membro ? "Editar pessoa da equipe" : "Adicionar pessoa à equipe"}</DialogTitle>
          <DialogDescription>Os dados saem no certificado dessa pessoa.</DialogDescription>
        </DialogHeader>
        <FormMembro eventoId={eventoId} membro={membro} atividades={atividades} aoSalvar={() => setAberto(false)} />
      </DialogContent>
    </Dialog>
  );
}

function FormMembro({
  eventoId,
  membro,
  atividades,
  aoSalvar,
}: {
  eventoId: string;
  membro?: MembroEquipe;
  atividades: AtividadeResumo[];
  aoSalvar: () => void;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<string>(membro?.tipo ?? "palestrante");
  const [atividadeId, setAtividadeId] = useState<string>(membro?.atividade_id ?? SEM_ATIVIDADE);
  const total = membro?.carga_horaria_minutos ?? 0;
  const [carga, setCarga] = useState({ horas: String(Math.floor(total / 60)), minutos: String(total % 60) });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const itensAtividade = [
    { value: SEM_ATIVIDADE, label: "Nenhuma (evento todo)" },
    ...atividades.map((a) => ({ value: a.id, label: a.titulo })),
  ];

  function escolherAtividade(id: string) {
    setAtividadeId(id);
    // Com atividade escolhida, a carga sugerida é a da atividade (continua editável).
    const a = atividades.find((x) => x.id === id);
    if (a) {
      setCarga({
        horas: String(Math.floor(a.carga_horaria_minutos / 60)),
        minutos: String(a.carga_horaria_minutos % 60),
      });
    }
  }

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const entrada = {
      ...Object.fromEntries(new FormData(e.currentTarget)),
      tipo,
      atividade_id: atividadeId === SEM_ATIVIDADE ? "" : atividadeId,
      carga_horas: carga.horas,
      carga_minutos: carga.minutos,
    };
    iniciar(async () => {
      const r = await chamar(() => salvarMembroEquipe(eventoId, membro?.id ?? null, entrada));
      if (!r.ok) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success(membro ? "Dados atualizados." : "Pessoa adicionada à equipe.");
      aoSalvar();
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo id="eq-nome" rotulo="Nome completo *">
        <Input id="eq-nome" name="nome" required maxLength={150} defaultValue={membro?.nome ?? ""} className="h-11 text-base" />
      </Campo>
      <Campo
        id="eq-email"
        rotulo="E-mail (opcional)"
        ajuda="Serve para avisar a pessoa e para ela baixar o PDF entrando com esse e-mail."
      >
        <Input
          id="eq-email"
          name="email"
          type="email"
          maxLength={254}
          defaultValue={membro?.email ?? ""}
          className="h-11 text-base"
        />
      </Campo>
      <div className="space-y-2">
        <Label htmlFor="eq-tipo">Tipo *</Label>
        <Select items={ITENS_TIPO} value={tipo} onValueChange={(v) => v && setTipo(v)}>
          <SelectTrigger id="eq-tipo" className="h-11 w-full text-base">
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
      </div>
      <Campo id="eq-funcao" rotulo="Função *" ajuda='Ex.: "Ministrante do minicurso", "Monitor(a)", "Comissão organizadora".'>
        <Input id="eq-funcao" name="funcao" required maxLength={120} defaultValue={membro?.funcao ?? ""} className="h-11 text-base" />
      </Campo>
      <div className="space-y-2">
        <Label htmlFor="eq-atividade">Atividade (opcional)</Label>
        <Select items={itensAtividade} value={atividadeId} onValueChange={(v) => v && escolherAtividade(v)}>
          <SelectTrigger id="eq-atividade" className="h-11 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {itensAtividade.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Carga horária *</legend>
        <div className="grid grid-cols-2 gap-4">
          <Campo id="eq-horas" rotulo="Horas">
            <Input
              id="eq-horas"
              type="number"
              inputMode="numeric"
              min={0}
              value={carga.horas}
              onChange={(e) => setCarga({ ...carga, horas: e.target.value })}
              className="h-11 text-base"
            />
          </Campo>
          <Campo id="eq-minutos" rotulo="Minutos">
            <Input
              id="eq-minutos"
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              value={carga.minutos}
              onChange={(e) => setCarga({ ...carga, minutos: e.target.value })}
              className="h-11 text-base"
            />
          </Campo>
        </div>
      </fieldset>
      <MensagemErro erro={erro} />
      <Button type="submit" className="h-11 w-full text-base" disabled={pendente}>
        {pendente && <Loader2 className="animate-spin" aria-hidden />}
        {membro ? "Salvar" : "Adicionar"}
      </Button>
    </form>
  );
}
