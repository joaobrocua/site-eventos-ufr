import { chaveDoDia } from "@/lib/datas";
import { dataPorExtenso, periodoPorExtenso } from "./data-extenso";
import type { Segmento } from "./quebra-linha";
import type { DadosCertificado } from "./tipos";

/** "4 horas", "1 hora", "1 hora e 30 minutos", "45 minutos". */
export function cargaHorariaPorExtenso(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  const horas = h === 1 ? "1 hora" : `${h} horas`;
  const mins = m === 1 ? "1 minuto" : `${m} minutos`;
  if (h === 0) return mins;
  return m === 0 ? horas : `${horas} e ${mins}`;
}

const MAX_TITULOS_NO_TEXTO = 3;

function listaComE(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

function funcaoPadrao(tipo: DadosCertificado["tipo"]): string {
  return tipo === "palestrante" ? "palestrante" : "membro da organização";
}

/** Atividades do parágrafo de equipe: no máximo 3 títulos e "mais N atividades". */
function trechoAtividades(d: DadosCertificado): string {
  const titulos = d.atividades.map((a) => a.titulo).filter(Boolean);
  if (titulos.length === 0) return "";
  if (titulos.length === 1) return `, na atividade “${titulos[0]}”`;
  const mostrados = titulos.slice(0, MAX_TITULOS_NO_TEXTO).map((t) => `“${t}”`);
  const restantes = titulos.length - mostrados.length;
  if (restantes > 0) mostrados.push(`mais ${restantes} ${restantes === 1 ? "atividade" : "atividades"}`);
  return `, nas atividades ${listaComE(mostrados)}`;
}

/**
 * ", promovido pela Secretaria X" — o organizador digita a continuação da frase
 * com o artigo ("pela ...", "pelo ..."), que o sistema não tem como adivinhar.
 * Sem preposição no início, usa "por".
 */
export function trechoPromotor(promotor: string | null | undefined): string {
  const p = promotor?.trim();
  if (!p) return "";
  return /^(por|pela|pelo|pelas|pelos)\s/i.test(p) ? `, promovido ${p}` : `, promovido por ${p}`;
}

/** Parágrafo principal (sem o nome, que vai em destaque), com negrito nos trechos-chave. */
export function paragrafoPrincipal(d: DadosCertificado): Segmento[] {
  const promotor = trechoPromotor(d.certificado_promotor);
  const realizado = `, realizado ${periodoPorExtenso(d.data_inicio, d.data_fim)}`;
  const local = d.evento_local ? `, em ${d.evento_local}` : "";
  const temCarga = d.carga_horaria_minutos > 0;
  const carga = cargaHorariaPorExtenso(d.carga_horaria_minutos);

  if (d.tipo === "participante") {
    return [
      { texto: "participou com êxito do evento " },
      { texto: d.evento_titulo, negrito: true },
      { texto: `${promotor}${realizado}${local}` },
      ...(temCarga
        ? [{ texto: ", contabilizando carga horária total de " }, { texto: carga, negrito: true }]
        : []),
      { texto: "." },
    ];
  }

  return [
    { texto: "atuou como " },
    { texto: d.funcao ?? funcaoPadrao(d.tipo), negrito: true },
    { texto: " no evento " },
    { texto: d.evento_titulo, negrito: true },
    { texto: `${trechoAtividades(d)}${promotor}${realizado}${local}` },
    ...(temCarga ? [{ texto: ", com carga horária de " }, { texto: carga, negrito: true }] : []),
    { texto: "." },
  ];
}

/** O mesmo parágrafo como texto simples. */
export function textoPrincipal(d: DadosCertificado): string {
  return paragrafoPrincipal(d)
    .map((s) => s.texto)
    .join("");
}

/** "Rondonópolis, 21 de outubro de 2026." (data de emissão no fuso de Cuiabá). */
export function linhaLocalEData(emitidoEm: string): string {
  return `Rondonópolis, ${dataPorExtenso(chaveDoDia(emitidoEm))}.`;
}
