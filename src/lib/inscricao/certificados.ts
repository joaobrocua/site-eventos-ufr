import type { AtividadeCertificado } from "@/lib/tipos";

/**
 * Espelha normalizar_codigo_certificado() do banco: ignora espaços, traços e
 * caixa, troca O/I/L por 0/1/1 (alfabeto Crockford) e põe os traços XXXX-XXXX-XXXX.
 */
export function normalizarCodigoCertificado(entrada: string) {
  const c = entrada
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return c.length === 12 ? `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}` : c;
}

/** Formato final válido de um código (para decidir se vale consultar). */
export function codigoCertificadoValido(codigo: string) {
  return /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(codigo);
}

/** "Atualizado em" só aparece se a diferença para a emissão passa de 1 minuto. */
export function foiAtualizado(emitidoEm: string, atualizadoEm: string) {
  return new Date(atualizadoEm).getTime() > new Date(emitidoEm).getTime() + 60_000;
}

/** Lê o jsonb de atividades com cuidado: ignora itens malformados. */
export function lerAtividadesCertificado(valor: unknown): AtividadeCertificado[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter(
    (a): a is AtividadeCertificado =>
      !!a && typeof a === "object" && typeof a.titulo === "string" && typeof a.inicio === "string",
  );
}
