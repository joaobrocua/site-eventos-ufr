import type { Database } from "@/lib/database.types";

// Atalhos para as linhas do banco. database.types.ts é GERADO:
//   npx supabase gen types typescript --local > src/lib/database.types.ts
type Tabelas = Database["public"]["Tables"];

export type Perfil = Tabelas["perfis"]["Row"];
export type Evento = Tabelas["eventos"]["Row"];
export type Atividade = Tabelas["atividades"]["Row"];
export type Inscricao = Tabelas["inscricoes"]["Row"];
export type InscricaoAtividade = Tabelas["inscricoes_atividades"]["Row"];
export type Trabalho = Tabelas["trabalhos"]["Row"];

export type StatusEvento = "rascunho" | "publicado" | "encerrado";
export type TipoAtividade =
  | "palestra"
  | "minicurso"
  | "oficina"
  | "mesa_redonda"
  | "apresentacao"
  | "outro";

export const ROTULO_STATUS_EVENTO: Record<StatusEvento, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  encerrado: "Encerrado",
};

export const ROTULO_TIPO_ATIVIDADE: Record<TipoAtividade, string> = {
  palestra: "Palestra",
  minicurso: "Minicurso",
  oficina: "Oficina",
  mesa_redonda: "Mesa-redonda",
  apresentacao: "Apresentação",
  outro: "Outro",
};

export const TIPOS_ATIVIDADE = Object.keys(ROTULO_TIPO_ATIVIDADE) as TipoAtividade[];

/** Resultado de registrar_presenca() no banco. */
export type ResultadoPresenca =
  | "registrado"
  | "ja_registrado"
  | "nao_inscrito"
  | "inscricao_cancelada"
  | "codigo_invalido";

/** Linha de vagas_por_atividade(): vagas null = ilimitadas; fila = pessoas na lista de espera. */
export type VagasAtividade = { atividade_id: string; vagas: number | null; ocupadas: number; fila: number };

export function vagasRestantes(v: Pick<VagasAtividade, "vagas" | "ocupadas">) {
  return v.vagas === null ? null : Math.max(0, v.vagas - v.ocupadas);
}

/** inscricoes_atividades.status */
export type StatusInscricaoAtividade = "confirmada" | "lista_espera" | "cancelada";

export type StatusTrabalho = "submetido" | "aprovado" | "reprovado" | "retirado";
export type ModalidadeTrabalho = "oral" | "poster";

export const ROTULO_STATUS_TRABALHO: Record<StatusTrabalho, string> = {
  submetido: "Em análise",
  aprovado: "Aprovado",
  reprovado: "Não aprovado",
  retirado: "Retirado",
};

export const ROTULO_MODALIDADE: Record<ModalidadeTrabalho, string> = {
  oral: "Apresentação oral",
  poster: "Pôster",
};

/** Bucket do Storage com os PDFs. Caminho: {evento_id}/{autor_id}/{trabalho_id}.pdf */
export const BUCKET_TRABALHOS = "trabalhos";
export const TAMANHO_MAX_PDF = 10 * 1024 * 1024;
// ---------- Certificados ----------
export type Certificado = Tabelas["certificados"]["Row"];
export type MembroEquipe = Tabelas["equipe_evento"]["Row"];

export type TipoCertificado = "participante" | "palestrante" | "organizacao";
export const ROTULO_TIPO_CERTIFICADO: Record<TipoCertificado, string> = {
  participante: "Participação",
  palestrante: "Palestrante / ministrante",
  organizacao: "Organização / monitoria",
};

/** eventos.certificado_assinaturas (até 3). */
export type Assinatura = { nome: string; cargo: string };

/** Item de certificados.atividades (retrato da emissão). */
export type AtividadeCertificado = {
  titulo: string;
  tipo: TipoAtividade;
  inicio: string;
  /** ausente em certificados emitidos antes do campo existir */
  fim?: string;
  carga_horaria_minutos: number;
};