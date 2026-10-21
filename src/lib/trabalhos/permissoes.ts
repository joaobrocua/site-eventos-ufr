/** O que o autor pode fazer com um trabalho, dado o status e se o prazo está aberto. */
export type AcoesTrabalho = {
  editar: boolean;
  reenviarPdf: boolean;
  baixarPdf: boolean;
  retirar: boolean;
};

export function acoesPermitidas(
  trabalho: { status: string; arquivo_path: string | null },
  prazoAberto: boolean,
  eventoPublicado: boolean,
): AcoesTrabalho {
  const submetido = trabalho.status === "submetido";
  return {
    editar: submetido && prazoAberto,
    reenviarPdf: submetido && prazoAberto && !trabalho.arquivo_path,
    baixarPdf: trabalho.arquivo_path !== null,
    // Em análise pode sempre; aprovado só enquanto o evento está publicado.
    retirar: submetido || (trabalho.status === "aprovado" && eventoPublicado),
  };
}
