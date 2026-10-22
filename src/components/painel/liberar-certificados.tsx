"use client";

import { useRouter } from "next/navigation";
import { Award } from "lucide-react";
import { toast } from "sonner";
import { formatarData } from "@/lib/datas";
import { Button } from "@/components/ui/button";
import { liberarCertificados } from "@/app/painel/eventos/certificados-actions";
import { chamar } from "./chamar";
import { ConfirmarAcao } from "./confirmar-acao";

export function LiberarCertificados({
  eventoId,
  status,
  liberadoEm,
  atividadesPendentes,
  totalAtividades,
  participantes,
  equipe,
  emailsPendentes,
}: {
  eventoId: string;
  status: string;
  liberadoEm: string | null;
  atividadesPendentes: number;
  totalAtividades: number;
  /** Inscritos com pelo menos 1 presença. */
  participantes: number;
  equipe: number;
  emailsPendentes: number;
}) {
  const router = useRouter();
  const atualizar = !!liberadoEm;

  let bloqueio: string | null = null;
  if (status === "rascunho") bloqueio = "Publique o evento antes de liberar os certificados.";
  else if (totalAtividades === 0) bloqueio = "O evento não tem atividades.";
  else if (atividadesPendentes > 0) {
    bloqueio = `Ainda ${atividadesPendentes === 1 ? "falta 1 atividade" : `faltam ${atividadesPendentes} atividades`} para acontecer. Os certificados só podem ser liberados depois que todas terminarem.`;
  }

  return (
    <div className="space-y-4">
      {liberadoEm && (
        <p className="text-sm font-medium text-success">
          Liberados em {formatarData(liberadoEm)}
        </p>
      )}

      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Participantes com ao menos 1 presença</dt>
          <dd className="text-lg font-semibold">{participantes}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Pessoas da equipe</dt>
          <dd className="text-lg font-semibold">{equipe}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">E-mails ainda na fila</dt>
          <dd className="text-lg font-semibold">{emailsPendentes}</dd>
        </div>
      </dl>

      {bloqueio && <p className="text-sm text-muted-foreground">{bloqueio}</p>}

      {atualizar && (
        <p className="text-sm text-muted-foreground">
          Use &quot;Atualizar certificados&quot; depois de corrigir presenças na tela de presença. O código de cada
          certificado não muda.
        </p>
      )}

      <ConfirmarAcao
        gatilho={
          <Button className="h-11 px-6 text-base" disabled={!!bloqueio}>
            <Award aria-hidden />
            {atualizar ? "Atualizar certificados" : "Liberar certificados"}
          </Button>
        }
        titulo={atualizar ? "Atualizar os certificados?" : "Liberar os certificados?"}
        descricao="Quem ainda não tinha certificado, ou teve o certificado alterado, recebe e-mail (membros da equipe só se tiverem e-mail cadastrado). Certificados revogados à mão não são reativados. Se precisar, você pode revisar as presenças e liberar de novo."
        rotuloConfirmar={atualizar ? "Sim, atualizar" : "Sim, liberar"}
        sucesso=""
        aoConfirmar={async () => {
          const r = await chamar(() => liberarCertificados(eventoId));
          if (r.ok) {
            const { novos, atualizados, revogados } = r.dados;
            toast.success(`${novos} novos, ${atualizados} atualizados, ${revogados} revogados`);
            return { ok: true, dados: undefined };
          }
          return r;
        }}
        aposSucesso={() => router.refresh()}
      />
    </div>
  );
}
