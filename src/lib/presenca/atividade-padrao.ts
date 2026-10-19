import { chaveDoDia } from "@/lib/datas";

type Janela = { id: string; inicio: string; fim: string };

/**
 * Atividade pré-selecionada na tela de presença:
 * 1) a que está acontecendo agora (se houver várias, a que começou por último);
 * 2) senão, a próxima de hoje (dia local de Cuiabá);
 * 3) senão, a primeira do evento.
 */
export function escolherAtividadePadrao(atividades: Janela[], agora: Date): string | null {
  if (atividades.length === 0) return null;
  const t = agora.getTime();
  const ordenadas = [...atividades].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));

  const emAndamento = ordenadas.filter((a) => Date.parse(a.inicio) <= t && t < Date.parse(a.fim));
  if (emAndamento.length > 0) return emAndamento[emAndamento.length - 1].id;

  const hoje = chaveDoDia(agora);
  const proximaDeHoje = ordenadas.find(
    (a) => Date.parse(a.inicio) > t && chaveDoDia(a.inicio) === hoje,
  );
  if (proximaDeHoje) return proximaDeHoje.id;

  return ordenadas[0].id;
}
