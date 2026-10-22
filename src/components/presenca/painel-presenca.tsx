"use client";

import { startTransition, useOptimistic, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Keyboard, ListChecks, ScanLine } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { marcarPresencaManual } from "@/app/painel/eventos/[id]/presenca/actions";
import { formatarIntervaloHoras } from "@/lib/datas";
import { ROTULO_TIPO_ATIVIDADE, type TipoAtividade } from "@/lib/tipos";
import type { Inscrito } from "@/lib/presenca/tipos";
import { ModoCamera } from "./modo-camera";
import { ModoCodigo } from "./modo-codigo";
import { ModoLista } from "./modo-lista";
import { useRegistroPresenca } from "./use-registro-presenca";

export type AtividadeOpcao = {
  id: string;
  titulo: string;
  tipo: string;
  inicio: string;
  fim: string;
};

type Props = {
  eventoId: string;
  atividades: AtividadeOpcao[];
  atividadeId: string;
  inscritos: Inscrito[];
  /** Evento encerrado: só a marcação manual na lista é aceita pelo banco. */
  somenteLista?: boolean;
};

type Modo = "camera" | "lista" | "codigo";

/** Use com `key={atividadeId}` para zerar o estado ao trocar de atividade. */
export function PainelPresenca({ eventoId, atividades, atividadeId, inscritos, somenteLista = false }: Props) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>(somenteLista ? "lista" : "camera");
  const registro = useRegistroPresenca(atividadeId);

  // Atualização otimista da lista: volta sozinha ao valor do servidor se a gravação falhar.
  const [lista, marcarOtimista] = useOptimistic(
    inscritos,
    (atual, p: { inscricaoId: string; presente: boolean }) =>
      atual.map((i) =>
        i.inscricaoId === p.inscricaoId
          ? { ...i, presenteEm: p.presente ? new Date().toISOString() : null }
          : i,
      ),
  );

  const presentes = lista.filter((i) => i.presenteEm).length;

  function alternar(inscricaoId: string, presente: boolean) {
    startTransition(async () => {
      marcarOtimista({ inscricaoId, presente });
      try {
        const r = await marcarPresencaManual({ inscricaoId, atividadeId, presente });
        if (!r.ok) toast.error(r.erro);
      } catch {
        toast.error("Sem conexão. A presença não foi salva.");
      }
    });
  }

  function trocarAtividade(id: string | null) {
    if (!id || id === atividadeId) return;
    router.replace(`/painel/eventos/${eventoId}/presenca?atividade=${id}`);
  }

  function trocarModo(novo: string) {
    registro.limpar();
    setModo(novo as Modo);
  }

  const opcoes = atividades.map((a) => ({
    value: a.id,
    label: `${formatarIntervaloHoras(a.inicio, a.fim)} · ${a.titulo}`,
  }));
  const atual = atividades.find((a) => a.id === atividadeId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span id="rotulo-atividade" className="text-sm font-medium text-muted-foreground">
          Atividade
          {atual && ` (${ROTULO_TIPO_ATIVIDADE[atual.tipo as TipoAtividade] ?? atual.tipo})`}
        </span>
        <Select items={opcoes} value={atividadeId} onValueChange={trocarAtividade}>
          <SelectTrigger aria-labelledby="rotulo-atividade" className="h-14 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="min-w-72">
            {opcoes.map((o) => (
              <SelectItem key={o.value} value={o.value} className="min-h-12 text-base">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="rounded-xl bg-primary px-4 py-3 text-center text-xl font-bold text-primary-foreground">
        Presentes: {presentes} de {lista.length} inscritos
      </p>

      <Tabs value={modo} onValueChange={trocarModo}>
        <TabsList className="h-12! w-full">
          <TabsTrigger value="camera" disabled={somenteLista} className="text-base">
            <ScanLine aria-hidden /> Câmera
          </TabsTrigger>
          <TabsTrigger value="lista" className="text-base">
            <ListChecks aria-hidden /> Lista
          </TabsTrigger>
          <TabsTrigger value="codigo" disabled={somenteLista} className="text-base">
            <Keyboard aria-hidden /> Código
          </TabsTrigger>
        </TabsList>

        <TabsContent value="camera" className="pt-2">
          <ModoCamera registro={registro} onUsarLista={() => trocarModo("lista")} />
        </TabsContent>
        <TabsContent value="lista" className="pt-2">
          <ModoLista inscritos={lista} onAlternar={alternar} />
        </TabsContent>
        <TabsContent value="codigo" className="pt-2">
          <ModoCodigo registro={registro} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
