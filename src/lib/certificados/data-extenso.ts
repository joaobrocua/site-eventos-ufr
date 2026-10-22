const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function partes(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return { ano: a, mes: m, dia: d };
}

/** "2026-10-21" -> "21 de outubro de 2026" (sem passar por fuso: é só texto). */
export function dataPorExtenso(iso: string): string {
  const { ano, mes, dia } = partes(iso);
  return `${dia} de ${MESES[mes - 1]} de ${ano}`;
}

/**
 * Período para o parágrafo, já com a preposição:
 * um dia -> "em 2 de outubro de 2026"; intervalo -> "de 10 a 12 de novembro de 2026".
 */
export function periodoPorExtenso(inicio: string, fim: string): string {
  if (!fim || inicio === fim) return `em ${dataPorExtenso(inicio)}`;
  const i = partes(inicio);
  const f = partes(fim);
  if (i.ano === f.ano && i.mes === f.mes) return `de ${i.dia} a ${f.dia} de ${MESES[f.mes - 1]} de ${f.ano}`;
  if (i.ano === f.ano) {
    return `de ${i.dia} de ${MESES[i.mes - 1]} a ${f.dia} de ${MESES[f.mes - 1]} de ${f.ano}`;
  }
  return `de ${dataPorExtenso(inicio)} a ${dataPorExtenso(fim)}`;
}
