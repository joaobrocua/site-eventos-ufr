import { Pencil, Plus } from "lucide-react";
import {
  agruparPorDia,
  formatarCargaHoraria,
  formatarDiaLongo,
  formatarIntervaloHoras,
} from "@/lib/datas";
import { ROTULO_TIPO_ATIVIDADE, type Atividade, type TipoAtividade } from "@/lib/tipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BaixarListaBotao } from "./baixar-lista";
import { DialogAtividade } from "./dialog-atividade";
import { ExcluirAtividadeBotao } from "./excluir-atividade";

export type ContagemAtividade = { inscritos: number; presentes: number; fila: number; trabalhos?: number };

export function ListaAtividades({
  eventoId,
  dataPadrao,
  dataFim,
  atividades,
  contagens,
}: {
  eventoId: string;
  dataPadrao: string;
  dataFim: string;
  atividades: Atividade[];
  contagens: Record<string, ContagemAtividade>;
}) {
  const grupos = agruparPorDia(atividades);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {atividades.length === 0
            ? "Nenhuma atividade ainda."
            : `${atividades.length} ${atividades.length === 1 ? "atividade" : "atividades"} no programa.`}
        </p>
        <DialogAtividade
          eventoId={eventoId}
          dataPadrao={dataPadrao}
          dataFim={dataFim}
          gatilho={
            <Button className="h-11 px-5 text-base">
              <Plus aria-hidden />
              Adicionar atividade
            </Button>
          }
        />
      </div>

      {atividades.length === 0 && (
        <Card>
          <CardContent className="space-y-2 py-6 text-center">
            <p className="font-medium">Comece pelo programa do evento</p>
            <p className="text-muted-foreground">
              Cadastre as palestras, minicursos e oficinas. As pessoas escolhem em quais querem
              participar. É preciso ter pelo menos uma atividade para publicar o evento.
            </p>
          </CardContent>
        </Card>
      )}

      {grupos.map(({ dia, itens }) => (
        <section key={dia} aria-labelledby={`dia-${dia}`} className="space-y-3">
          <h3 id={`dia-${dia}`} className="text-base font-semibold capitalize">
            {formatarDiaLongo(itens[0].inicio)}
          </h3>
          <ul className="space-y-3">
            {itens.map((a) => {
              const c = contagens[a.id] ?? { inscritos: 0, presentes: 0, fila: 0 };
              return (
                <li key={a.id}>
                  <Card size="sm">
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="text-base font-medium">{a.titulo}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatarIntervaloHoras(a.inicio, a.fim)}
                            {a.local ? ` · ${a.local}` : ""}
                            {a.palestrantes ? ` · ${a.palestrantes}` : ""}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {ROTULO_TIPO_ATIVIDADE[a.tipo as TipoAtividade] ?? a.tipo}
                        </Badge>
                      </div>

                      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        <div className="flex gap-1">
                          <dt className="text-muted-foreground">Inscritos:</dt>
                          <dd className="font-medium">
                            {c.inscritos}
                            {a.vagas === null ? " (vagas ilimitadas)" : ` de ${a.vagas} vagas`}
                          </dd>
                        </div>
                        {c.fila > 0 && (
                          <div className="flex gap-1">
                            <dt className="text-muted-foreground">Lista de espera:</dt>
                            <dd className="font-medium text-warning">{c.fila} na lista de espera</dd>
                          </div>
                        )}
                        <div className="flex gap-1">
                          <dt className="text-muted-foreground">Presentes:</dt>
                          <dd className="font-medium">{c.presentes}</dd>
                        </div>
                        <div className="flex gap-1">
                          <dt className="text-muted-foreground">Carga horária:</dt>
                          <dd className="font-medium">{formatarCargaHoraria(a.carga_horaria_minutos)}</dd>
                        </div>
                      </dl>

                      <div className="flex flex-wrap gap-2">
                        <DialogAtividade
                          eventoId={eventoId}
                          atividade={a}
                          trabalhos={c.trabalhos ?? 0}
                          dataPadrao={dataPadrao}
          dataFim={dataFim}
                          gatilho={
                            <Button variant="outline" size="sm">
                              <Pencil aria-hidden />
                              Editar
                            </Button>
                          }
                        />
                        <BaixarListaBotao
                          href={`/painel/eventos/${eventoId}/exportar?atividade=${a.id}`}
                          nomePadrao="lista-de-presenca.csv"
                        >
                          Lista de presença (Excel)
                        </BaixarListaBotao>
                        <ExcluirAtividadeBotao
                          eventoId={eventoId}
                          atividadeId={a.id}
                          titulo={a.titulo}
                          inscritos={c.inscritos}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

