// Datas e horários SEMPRE exibidos no fuso de Rondonópolis (America/Cuiaba, UTC-4).
// O servidor (Vercel) roda em UTC: sem fixar o fuso, uma atividade às 21h
// apareceria no dia seguinte. Nunca use toLocaleString() sem timeZone.

export const FUSO = "America/Cuiaba";

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const fmtDiaLongo = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  hour: "2-digit",
  minute: "2-digit",
});

const fmtChaveDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type Instante = string | Date;
const paraDate = (v: Instante) => (v instanceof Date ? v : new Date(v));

/** "10/11/2026" (timestamptz) */
export function formatarData(v: Instante) {
  return fmtData.format(paraDate(v));
}

/** "14:00" */
export function formatarHora(v: Instante) {
  return fmtHora.format(paraDate(v));
}

/** "14:00 – 18:00" */
export function formatarIntervaloHoras(inicio: Instante, fim: Instante) {
  return `${formatarHora(inicio)} – ${formatarHora(fim)}`;
}

/** "terça-feira, 10 de novembro" */
export function formatarDiaLongo(v: Instante) {
  return fmtDiaLongo.format(paraDate(v));
}

/** "2026-11-10": dia local (Cuiabá) de um instante. Útil para agrupar. */
export function chaveDoDia(v: Instante) {
  return fmtChaveDia.format(paraDate(v));
}

/**
 * Colunas `date` do banco (eventos.data_inicio/data_fim) chegam como "2026-11-10".
 * new Date("2026-11-10") seria meia-noite UTC = dia anterior em Cuiabá; por isso
 * formatamos direto do texto.
 */
export function formatarDataSimples(isoDate: string) {
  const [a, m, d] = isoDate.split("-");
  return `${d}/${m}/${a}`;
}

/** "10 a 12/11/2026", "10/11/2026" ou "28/11 a 02/12/2026" */
export function formatarPeriodo(dataInicio: string, dataFim: string) {
  if (dataInicio === dataFim) return formatarDataSimples(dataInicio);
  const [ai, mi, di] = dataInicio.split("-");
  const [af, mf, df] = dataFim.split("-");
  if (ai === af && mi === mf) return `${di} a ${df}/${mf}/${af}`;
  if (ai === af) return `${di}/${mi} a ${df}/${mf}/${af}`;
  return `${di}/${mi}/${ai} a ${df}/${mf}/${af}`;
}

/** Agrupa itens com `inicio` por dia local, em ordem cronológica. */
export function agruparPorDia<T extends { inicio: string }>(itens: T[]) {
  const ordenados = [...itens].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const grupos = new Map<string, T[]>();
  for (const item of ordenados) {
    const chave = chaveDoDia(item.inicio);
    const lista = grupos.get(chave);
    if (lista) lista.push(item);
    else grupos.set(chave, [item]);
  }
  return [...grupos.entries()].map(([dia, itensDoDia]) => ({ dia, itens: itensDoDia }));
}

/** Duas atividades se sobrepõem no tempo (fim exclusivo: 10–12 e 12–14 não chocam). */
export function haChoque(
  a: { inicio: Instante; fim: Instante },
  b: { inicio: Instante; fim: Instante },
) {
  return (
    paraDate(a.inicio).getTime() < paraDate(b.fim).getTime() &&
    paraDate(b.inicio).getTime() < paraDate(a.fim).getTime()
  );
}

/** "4h", "1h30", "45 min" */
export function formatarCargaHoraria(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Converte data + hora digitadas num formulário (horário de Cuiabá) para ISO
 * com offset: ("2026-11-10", "14:00") -> "2026-11-10T14:00:00-04:00".
 * Cuiabá não tem horário de verão desde 2019, então o offset é fixo.
 */
export function paraInstanteCuiaba(data: string, hora: string) {
  return `${data}T${hora}:00-04:00`;
}

/** Inverso de paraInstanteCuiaba: instante -> { data: "2026-11-10", hora: "14:00" } em Cuiabá. */
export function separarDataHoraCuiaba(v: Instante) {
  return { data: chaveDoDia(v), hora: formatarHora(v) };
}
