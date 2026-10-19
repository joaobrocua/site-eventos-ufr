import type { Database } from "@/lib/database.types";

// Atalhos para as linhas do banco. database.types.ts é GERADO:
//   npx supabase gen types typescript --local > src/lib/database.types.ts
type Tabelas = Database["public"]["Tables"];

export type Perfil = Tabelas["perfis"]["Row"];
export type Evento = Tabelas["eventos"]["Row"];
export type Atividade = Tabelas["atividades"]["Row"];
export type Inscricao = Tabelas["inscricoes"]["Row"];
export type InscricaoAtividade = Tabelas["inscricoes_atividades"]["Row"];

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

/** Linha de vagas_por_atividade(): vagas null = ilimitadas. */
export type VagasAtividade = { atividade_id: string; vagas: number | null; ocupadas: number };

export function vagasRestantes(v: Pick<VagasAtividade, "vagas" | "ocupadas">) {
  return v.vagas === null ? null : Math.max(0, v.vagas - v.ocupadas);
}
