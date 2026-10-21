import { Clock, MapPin, Timer, User } from "lucide-react";
import { formatarCargaHoraria, formatarIntervaloHoras } from "@/lib/datas";
import { estaEsgotada, textoVagas } from "@/lib/inscricao/regras";
import {
  ROTULO_MODALIDADE,
  ROTULO_TIPO_ATIVIDADE,
  type ModalidadeTrabalho,
  type TipoAtividade,
} from "@/lib/tipos";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AtividadePublica = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  palestrantes: string | null;
  local: string | null;
  inicio: string;
  fim: string;
  carga_horaria_minutos: number;
  vagas: { vagas: number | null; ocupadas: number; fila: number } | undefined;
  /** Trabalhos apresentados nesta sessão (só tipo 'apresentacao'), já na ordem. */
  trabalhos: TrabalhoPublico[];
};

export type TrabalhoPublico = {
  id: string;
  titulo: string;
  autores: string;
  modalidade: string;
};

/** Dados de uma atividade (sem interação). `tituloId` liga o título ao checkbox via aria. */
export function AtividadeInfo({
  atividade: a,
  tituloId,
}: {
  atividade: AtividadePublica;
  tituloId?: string;
}) {
  const vagas = textoVagas(a.vagas);
  const esgotada = estaEsgotada(a.vagas);
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {ROTULO_TIPO_ATIVIDADE[a.tipo as TipoAtividade] ?? "Atividade"}
        </Badge>
        {vagas && (
          <span
            className={cn(
              "text-sm font-medium",
              esgotada ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {vagas}
          </span>
        )}
      </div>
      <h4 id={tituloId} className="text-base font-semibold leading-snug">
        {a.titulo}
      </h4>
      <ul className="space-y-1 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Clock className="size-4 shrink-0" aria-hidden />
          <span>{formatarIntervaloHoras(a.inicio, a.fim)}</span>
        </li>
        {a.local && (
          <li className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span>{a.local}</span>
          </li>
        )}
        {a.palestrantes && (
          <li className="flex items-center gap-2">
            <User className="size-4 shrink-0" aria-hidden />
            <span>{a.palestrantes}</span>
          </li>
        )}
        <li className="flex items-center gap-2">
          <Timer className="size-4 shrink-0" aria-hidden />
          <span>Carga horária: {formatarCargaHoraria(a.carga_horaria_minutos)}</span>
        </li>
      </ul>
      {a.descricao && <p className="whitespace-pre-line text-sm">{a.descricao}</p>}
      {a.tipo === "apresentacao" && a.trabalhos.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-sm font-medium">Trabalhos desta sessão</p>
          <ol className="space-y-2">
            {a.trabalhos.map((t) => (
              <li key={t.id} className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">{t.titulo}</p>
                <p className="text-muted-foreground">{t.autores}</p>
                <Badge variant="outline" className="mt-1">
                  {ROTULO_MODALIDADE[t.modalidade as ModalidadeTrabalho] ?? "Trabalho"}
                </Badge>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
