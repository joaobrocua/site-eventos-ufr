/** A data (AAAA-MM-DD) está fora do período do evento? Vazia/inválida não conta como fora. */
export function foraDoPeriodo(data: string, dataInicio: string, dataFim: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  return data < dataInicio || data > dataFim;
}
