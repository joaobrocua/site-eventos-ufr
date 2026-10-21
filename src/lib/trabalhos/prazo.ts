export type MotivoFechado = "nao_publicado" | "nao_aberta" | "prazo_encerrado";

export type EstadoSubmissao =
  | { aberto: true }
  | { aberto: false; motivo: MotivoFechado; mensagem: string };

type DadosEvento = {
  status: string;
  submissoes_abertas: boolean;
  submissoes_ate: string | null;
};

/** Mesma regra do banco (_submissoes_abertas): publicado, aberto e dentro do prazo (inclusive). */
export function estadoSubmissao(evento: DadosEvento, agora: Date): EstadoSubmissao {
  if (evento.status !== "publicado") {
    return {
      aberto: false,
      motivo: "nao_publicado",
      mensagem: "Este evento não está recebendo trabalhos no momento.",
    };
  }
  if (!evento.submissoes_abertas) {
    return {
      aberto: false,
      motivo: "nao_aberta",
      mensagem: "O envio de trabalhos para este evento não está aberto.",
    };
  }
  if (evento.submissoes_ate && agora.getTime() > Date.parse(evento.submissoes_ate)) {
    return {
      aberto: false,
      motivo: "prazo_encerrado",
      mensagem: "O prazo para enviar trabalhos deste evento terminou.",
    };
  }
  return { aberto: true };
}
