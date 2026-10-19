import type { ResultadoPresenca } from "@/lib/tipos";

/** Pessoa inscrita (confirmada) na atividade, como a lista precisa. */
export type Inscrito = {
  inscricaoId: string;
  nome: string;
  rga: string | null;
  curso: string | null;
  /** ISO da presença, ou null se ausente. */
  presenteEm: string | null;
};

/** Resposta da action de registrar presença. */
export type RespostaPresenca = {
  resultado: ResultadoPresenca;
  inscricaoId: string | null;
  nome: string | null;
  rga: string | null;
  presenteEm: string | null;
};

/** O que o painel de resultado mostra (inclui falhas que não vêm do banco). */
export type ResultadoTela =
  | { tipo: ResultadoPresenca; dados: RespostaPresenca; codigo: string }
  | { tipo: "qr_invalido" }
  | { tipo: "erro"; mensagem: string };

/** Quanto tempo o painel fica na tela antes de voltar a ler; null = espera decisão. */
export function duracaoDoResultado(r: ResultadoTela): number | null {
  switch (r.tipo) {
    case "registrado":
    case "ja_registrado":
      return 2000;
    case "inscricao_cancelada":
    case "codigo_invalido":
    case "qr_invalido":
      return 3000;
    case "nao_inscrito":
    case "erro":
      return null;
  }
}
