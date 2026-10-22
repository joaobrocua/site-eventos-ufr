import type { Assinatura, AtividadeCertificado, TipoCertificado } from "@/lib/tipos";

/** Dados de dados_certificado() já tipados para o gerador. */
export type DadosCertificado = {
  codigo: string;
  tipo: TipoCertificado;
  nome: string;
  documento: string | null;
  funcao: string | null;
  atividades: AtividadeCertificado[];
  carga_horaria_minutos: number;
  emitido_em: string;
  evento_titulo: string;
  evento_local: string | null;
  data_inicio: string;
  data_fim: string;
  certificado_texto: string | null;
  certificado_registro: string | null;
  certificado_promotor: string | null;
  certificado_assinaturas: Assinatura[];
};

type Objeto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);
const texto = (v: unknown) => (typeof v === "string" ? v : "");
const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Converte a linha do banco (jsonb solto) em DadosCertificado, sem confiar no formato. */
export function converterLinha(linha: Objeto): DadosCertificado {
  const atividades = (Array.isArray(linha.atividades) ? linha.atividades : [])
    .filter(ehObjeto)
    .map((a) => ({
      titulo: texto(a.titulo),
      tipo: texto(a.tipo) as AtividadeCertificado["tipo"],
      inicio: texto(a.inicio),
      // certificados emitidos antes do campo existir não têm `fim`
      ...(texto(a.fim) ? { fim: texto(a.fim) } : {}),
      carga_horaria_minutos: numero(a.carga_horaria_minutos),
    }));
  const assinaturas = (Array.isArray(linha.certificado_assinaturas) ? linha.certificado_assinaturas : [])
    .filter(ehObjeto)
    .map((a) => ({ nome: texto(a.nome), cargo: texto(a.cargo) }))
    .filter((a) => a.nome.trim())
    .slice(0, 3);

  const tipo = linha.tipo === "palestrante" || linha.tipo === "organizacao" ? linha.tipo : "participante";
  return {
    codigo: texto(linha.codigo).toUpperCase(),
    tipo,
    nome: texto(linha.nome),
    documento: texto(linha.documento) || null,
    funcao: texto(linha.funcao) || null,
    atividades,
    carga_horaria_minutos: numero(linha.carga_horaria_minutos),
    emitido_em: texto(linha.emitido_em),
    evento_titulo: texto(linha.evento_titulo),
    evento_local: texto(linha.evento_local) || null,
    data_inicio: texto(linha.data_inicio),
    data_fim: texto(linha.data_fim),
    certificado_texto: texto(linha.certificado_texto).trim() || null,
    certificado_registro: texto(linha.certificado_registro).trim() || null,
    certificado_promotor: texto(linha.certificado_promotor).trim() || null,
    certificado_assinaturas: assinaturas,
  };
}
