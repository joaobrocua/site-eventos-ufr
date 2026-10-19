// As funções do banco lançam erros com `message` em português (pronta para a tela)
// e `hint` com um código estável. Aqui convertemos qualquer erro do Supabase numa
// mensagem amigável, sem vazar detalhes técnicos.

export type CodigoErro =
  | "nao_autenticado"
  | "perfil_incompleto"
  | "evento_indisponivel"
  | "inscricoes_encerradas"
  | "atividade_invalida"
  | "vagas_esgotadas"
  | "choque_horario"
  | "nao_inscrito"
  | "presenca_registrada"
  | "sem_permissao"
  | "atividade_encerrada"
  | "atividade_com_inscritos"
  | "evento_com_inscritos"
  | "vagas_abaixo_inscritos";

const CODIGOS = new Set<string>([
  "nao_autenticado",
  "perfil_incompleto",
  "evento_indisponivel",
  "inscricoes_encerradas",
  "atividade_invalida",
  "vagas_esgotadas",
  "choque_horario",
  "nao_inscrito",
  "presenca_registrada",
  "sem_permissao",
  "atividade_encerrada",
  "atividade_com_inscritos",
  "evento_com_inscritos",
  "vagas_abaixo_inscritos",
]);

type ErroSupabase = { message?: string; hint?: string | null; code?: string } | null | undefined;

export const MENSAGEM_GENERICA = "Algo deu errado. Tente novamente em instantes.";

/** Código de negócio vindo do banco (hint), ou null se for um erro técnico. */
export function codigoDoErro(erro: ErroSupabase): CodigoErro | null {
  const hint = erro?.hint ?? "";
  return CODIGOS.has(hint) ? (hint as CodigoErro) : null;
}

/** Mensagem para mostrar ao usuário. Erros técnicos viram uma mensagem genérica. */
export function mensagemDoErro(erro: ErroSupabase, padrao = MENSAGEM_GENERICA) {
  if (!erro) return padrao;
  if (codigoDoErro(erro) && erro.message) return erro.message;
  // 23505 = violação de unicidade (ex.: slug repetido)
  if (erro.code === "23505") return "Já existe um registro com esses dados.";
  // 42501 = bloqueado pela RLS/permissão
  if (erro.code === "42501") return "Você não tem permissão para fazer isso.";
  return padrao;
}

/** Resultado padrão das server actions. */
export type ResultadoAcao<T = undefined> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; codigo?: CodigoErro | null };
