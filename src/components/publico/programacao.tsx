"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Hourglass, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { agruparPorDia, formatarDiaLongo } from "@/lib/datas";
import {
  bloqueiosPorChoque,
  estaEsgotada,
  jaAconteceu,
  mensagemPosicaoFila,
  textoSelecionadas,
} from "@/lib/inscricao/regras";
import {
  cancelarInscricao,
  entrarListaEspera,
  inscrever,
  removerAtividade,
  sairListaEspera,
} from "@/app/eventos/[slug]/actions";
import type { ResultadoAcao } from "@/lib/erros";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { AtividadeInfo, type AtividadePublica } from "./atividade-info";

type Props = {
  eventoId: string;
  slug: string;
  atividades: AtividadePublica[];
  /** Pode escolher atividades (logado, com perfil e inscrições abertas). */
  podeEscolher: boolean;
  /** Pode remover atividade / cancelar (evento ainda publicado). */
  podeAlterar: boolean;
  inscrito: boolean;
  inscritas: string[];
  presentes: string[];
  /** Atividades em que o aluno está na lista de espera. */
  fila: { atividadeId: string; posicao: number }[];
};

const ERRO_SEM_CONEXAO = "Sem conexão. Tente novamente.";
const ERRO_PADRAO = "Algo deu errado. Tente novamente em instantes.";

export function Programacao({
  eventoId,
  slug,
  atividades,
  podeEscolher,
  podeAlterar,
  inscrito,
  inscritas,
  presentes,
  fila,
}: Props) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [fazendo, setFazendo] = useState<string | null>(null);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const [agora] = useState(() => new Date());

  const fixas = useMemo(() => new Set(inscritas), [inscritas]);
  const posicaoNaFila = useMemo(() => new Map(fila.map((f) => [f.atividadeId, f.posicao])), [fila]);
  const idsNaFila = useMemo(() => new Set(fila.map((f) => f.atividadeId)), [fila]);
  const jaPresente = useMemo(() => new Set(presentes), [presentes]);
  const dias = useMemo(() => agruparPorDia(atividades), [atividades]);
  const bloqueios = useMemo(
    () => bloqueiosPorChoque(atividades, selecionadas, fixas, idsNaFila),
    [atividades, selecionadas, fixas, idsNaFila],
  );
  const total = selecionadas.size;

  function alternar(id: string) {
    setErro(null);
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function executar<T>(
    chave: string,
    acao: () => Promise<ResultadoAcao<T>>,
    sucesso: string | ((dados: T) => string),
    aoTerminar?: () => void,
  ) {
    setErro(null);
    setFazendo(chave);
    iniciar(async () => {
      try {
        const r = await acao();
        if (!r.ok) {
          const msg = r.erro || ERRO_PADRAO;
          setErro(msg);
          toast.error(msg);
          // Erro de regra (vagas, choque, prazo...): recarrega para mostrar o estado atual.
          if (r.codigo) router.refresh();
          return;
        }
        toast.success(typeof sucesso === "function" ? sucesso(r.dados) : sucesso);
        aoTerminar?.();
      } catch {
        setErro(ERRO_SEM_CONEXAO);
        toast.error(ERRO_SEM_CONEXAO);
      } finally {
        setFazendo(null);
      }
    });
  }

  function confirmar() {
    executar(
      "inscrever",
      () => inscrever({ eventoId, slug, atividades: [...selecionadas] }),
      inscrito ? "Atividades adicionadas!" : "Inscrição confirmada!",
      () => setSelecionadas(new Set()),
    );
  }

  function remover(id: string) {
    executar(`remover:${id}`, () => removerAtividade({ atividadeId: id, slug }), "Atividade removida.");
  }

  function entrarNaFila(id: string) {
    executar(
      `fila:${id}`,
      () => entrarListaEspera({ atividadeId: id, slug }),
      (d) => mensagemPosicaoFila(d.posicao),
    );
  }

  function sairDaFila(id: string) {
    executar(`sair:${id}`, () => sairListaEspera({ atividadeId: id, slug }), "Você saiu da lista de espera.");
  }

  function cancelar() {
    executar("cancelar", () => cancelarInscricao({ eventoId, slug }), "Inscrição cancelada.", () => {
      setConfirmarCancelar(false);
      setSelecionadas(new Set());
    });
  }

  return (
    <div className="space-y-8">
      {dias.map(({ dia, itens }) => (
        <section key={dia} aria-labelledby={`dia-${dia}`} className="space-y-3">
          <h3 id={`dia-${dia}`} className="text-lg font-semibold first-letter:uppercase">
            {formatarDiaLongo(itens[0].inicio)}
          </h3>
          <ul className="space-y-3">
            {itens.map((a) => {
              const estaInscrita = fixas.has(a.id);
              const posicao = posicaoNaFila.get(a.id);
              const marcada = selecionadas.has(a.id);
              const encerrada = jaAconteceu(a, agora);
              const motivo = encerrada ? "Já aconteceu" : bloqueios.get(a.id);
              const esgotada = estaEsgotada(a.vagas);
              const escolhivel = podeEscolher && !estaInscrita && posicao === undefined;
              const desabilitada = pendente || !!motivo || (esgotada && !marcada);
              const tituloId = `ativ-${a.id}`;
              const presente = jaPresente.has(a.id);

              return (
                <li
                  key={a.id}
                  onClick={(e) => {
                    // Toda a área do cartão marca/desmarca (alvo de toque grande).
                    if (!escolhivel || desabilitada) return;
                    if ((e.target as HTMLElement).closest("a,button,[data-slot=checkbox]")) return;
                    alternar(a.id);
                  }}
                  className={cn(
                    "flex gap-3 rounded-xl border bg-card p-4 text-card-foreground",
                    escolhivel && !desabilitada && "cursor-pointer hover:border-primary/50",
                    marcada && "border-primary bg-primary/5 ring-1 ring-primary",
                    escolhivel && desabilitada && !marcada && "opacity-70",
                  )}
                >
                  {escolhivel && (
                    <div className="pt-1">
                      <Checkbox
                        className="size-6 rounded-md"
                        checked={marcada}
                        disabled={desabilitada}
                        onCheckedChange={() => alternar(a.id)}
                        aria-label={a.titulo}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-3">
                    <AtividadeInfo atividade={a} tituloId={tituloId} />
                    {escolhivel && motivo && (
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
                        {encerrada ? motivo : `Mesmo horário de ${motivo}`}
                      </p>
                    )}
                    {escolhivel && esgotada && !marcada && !encerrada && !bloqueios.has(a.id) && (
                      <Button
                        variant="outline"
                        className="h-11 text-base"
                        disabled={pendente}
                        onClick={() => entrarNaFila(a.id)}
                      >
                        {fazendo === `fila:${a.id}` && <Loader2 className="animate-spin" aria-hidden />}
                        Entrar na lista de espera
                      </Button>
                    )}
                    {escolhivel && esgotada && !marcada && !encerrada && !bloqueios.has(a.id) && (
                      <p className="text-sm text-muted-foreground">
                        O seu lugar na fila reserva este horário: você não poderá escolher outra atividade
                        no mesmo horário. Se abrir uma vaga, você é inscrito automaticamente. Pode sair da
                        fila quando quiser.
                      </p>
                    )}
                    {posicao !== undefined && (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                          <Hourglass className="size-4 text-warning" aria-hidden />
                          Lista de espera · você é o {posicao}º
                        </span>
                        {podeAlterar && (
                          <Button
                            variant="outline"
                            className="h-10"
                            disabled={pendente}
                            onClick={() => sairDaFila(a.id)}
                            aria-label={`Sair da fila de ${a.titulo}`}
                          >
                            {fazendo === `sair:${a.id}` && <Loader2 className="animate-spin" aria-hidden />}
                            Sair da fila
                          </Button>
                        )}
                      </div>
                    )}
                    {estaInscrita && (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                          <CheckCircle2 className="size-4" aria-hidden />
                          {presente ? "Presença registrada" : "Você está inscrito nesta atividade"}
                        </span>
                        {podeAlterar && !presente && (
                          <Button
                            variant="outline"
                            className="h-10"
                            disabled={pendente}
                            onClick={() => remover(a.id)}
                            aria-label={`Remover a atividade ${a.titulo}`}
                          >
                            {fazendo === `remover:${a.id}` ? (
                              <Loader2 className="animate-spin" aria-hidden />
                            ) : (
                              <Trash2 aria-hidden />
                            )}
                            Remover
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {erro && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
          {erro}
        </p>
      )}

      {inscrito && podeAlterar && jaPresente.size === 0 && (
        <div className="border-t pt-6">
          <Button
            variant="destructive"
            className="h-11 text-base"
            onClick={() => setConfirmarCancelar(true)}
            disabled={pendente}
          >
            Cancelar minha inscrição
          </Button>
        </div>
      )}

      {podeEscolher && total > 0 && (
        <div className="sticky bottom-0 z-30 -mx-4 border-t bg-background/95 p-3 shadow-[0_-4px_12px_rgb(0_0_0/0.06)] backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center font-medium sm:text-left" aria-live="polite">
              {textoSelecionadas(total)}
            </p>
            <Button className="h-11 text-base" onClick={confirmar} disabled={pendente}>
              {fazendo === "inscrever" && <Loader2 className="animate-spin" aria-hidden />}
              {inscrito ? "Adicionar à minha inscrição" : "Confirmar inscrição"}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmarCancelar} onOpenChange={setConfirmarCancelar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar sua inscrição?</AlertDialogTitle>
            <AlertDialogDescription>
              Você sairá de todas as atividades deste evento e liberará as vagas. Se mudar de
              ideia, poderá se inscrever de novo enquanto houver vagas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendente}>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pendente} onClick={cancelar}>
              {fazendo === "cancelar" && <Loader2 className="animate-spin" aria-hidden />}
              Sim, cancelar inscrição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
