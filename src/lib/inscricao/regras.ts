import { haChoque } from "@/lib/datas";
import { vagasRestantes } from "@/lib/tipos";

type Horario = { id: string; titulo: string; inicio: string; fim: string };

/**
 * Para cada atividade NÃO selecionada que choca com alguma já escolhida,
 * devolve o título da atividade com a qual ela choca (para mostrar o motivo).
 * `fixas` são atividades em que o aluno já está inscrito e `naFila` as da lista de
 * espera: as duas contam como horário ocupado (um lugar na fila pode virar vaga a qualquer momento).
 */
export function bloqueiosPorChoque(
  atividades: Horario[],
  selecionadas: ReadonlySet<string>,
  fixas: ReadonlySet<string> = new Set(),
  naFila: ReadonlySet<string> = new Set(),
) {
  const ocupada = (id: string) => selecionadas.has(id) || fixas.has(id) || naFila.has(id);
  const escolhidas = atividades.filter((a) => ocupada(a.id));
  const bloqueios = new Map<string, string>();
  for (const a of atividades) {
    if (ocupada(a.id)) continue;
    const outra = escolhidas.find((e) => e.id !== a.id && haChoque(a, e));
    if (outra) bloqueios.set(a.id, outra.titulo);
  }
  return bloqueios;
}

export type SituacaoInscricoes =
  | { abertas: true }
  | { abertas: false; motivo: "evento_encerrado" | "inscricoes_fechadas" | "prazo_encerrado" };

/** Decide se o evento ainda aceita inscrições (espelha a checagem da função do banco). */
export function situacaoInscricoes(
  evento: { status: string; inscricoes_abertas: boolean; inscricoes_ate: string | null },
  agora: Date = new Date(),
): SituacaoInscricoes {
  if (evento.status !== "publicado") return { abertas: false, motivo: "evento_encerrado" };
  if (!evento.inscricoes_abertas) return { abertas: false, motivo: "inscricoes_fechadas" };
  if (evento.inscricoes_ate && agora.getTime() > new Date(evento.inscricoes_ate).getTime()) {
    return { abertas: false, motivo: "prazo_encerrado" };
  }
  return { abertas: true };
}

export const MENSAGEM_SITUACAO = {
  evento_encerrado: "Este evento já foi encerrado.",
  inscricoes_fechadas: "As inscrições para este evento estão fechadas.",
  prazo_encerrado: "O prazo de inscrição deste evento terminou.",
} as const;

type Lotacao = { vagas: number | null; ocupadas: number; fila?: number };

/**
 * Lotada = sem vagas OU com gente na fila (a fila existente tem prioridade
 * sobre quem chega depois). Atividade de vagas ilimitadas nunca lota.
 */
export function estaEsgotada(v: Lotacao | undefined) {
  if (!v || v.vagas === null) return false;
  return vagasRestantes(v) === 0 || (v.fila ?? 0) > 0;
}

/** "Vagas ilimitadas" / "Restam 3 vagas" / "Resta 1 vaga" / "Lotado" / "Lotado · 2 na lista de espera" */
export function textoVagas(v: Lotacao | undefined) {
  if (!v) return null;
  if (estaEsgotada(v)) {
    const f = v.fila ?? 0;
    return f > 0 ? `Lotado · ${f} na lista de espera` : "Lotado";
  }
  const r = vagasRestantes(v);
  if (r === null) return "Vagas ilimitadas";
  return r === 1 ? "Resta 1 vaga" : `Restam ${r} vagas`;
}

/** Mensagem após entrar na fila. */
export function mensagemPosicaoFila(posicao: number) {
  return `Você é o ${posicao}º da fila. Se abrir uma vaga, você será inscrito automaticamente e avisado por e-mail.`;
}

/** Envio de trabalhos aberto: evento publicado, flag ligada e prazo (se houver) no futuro. */
export function submissoesAbertas(
  e: { status: string; submissoes_abertas: boolean; submissoes_ate: string | null },
  agora: Date = new Date(),
) {
  if (e.status !== "publicado" || !e.submissoes_abertas) return false;
  return !e.submissoes_ate || agora.getTime() <= new Date(e.submissoes_ate).getTime();
}

/** Evento "anterior": encerrado ou com data_fim antes de hoje (dia local, YYYY-MM-DD). */
export function eventoAnterior(
  e: { status: string; data_fim: string },
  hojeLocal: string,
) {
  return e.status === "encerrado" || e.data_fim < hojeLocal;
}

/** "3 atividades selecionadas" / "1 atividade selecionada" / "Nenhuma atividade selecionada" */
export function textoSelecionadas(n: number) {
  if (n === 0) return "Nenhuma atividade selecionada";
  return n === 1 ? "1 atividade selecionada" : `${n} atividades selecionadas`;
}

/** Atividade que já terminou não aceita inscrição (o banco recusa: atividade_encerrada). */
export function jaAconteceu(a: { fim: string }, agora: Date = new Date()) {
  return new Date(a.fim).getTime() <= agora.getTime();
}
