import { quebrarLinhas, quebrarSegmentos, type Segmento, type Trecho } from "./quebra-linha";

export const LARGURA = 841.89; // A4 paisagem, em pontos
export const ALTURA = 595.28;
export const MARGEM = 48;
export const AREA = LARGURA - 2 * MARGEM;
/** Distância da moldura até a borda da página. */
export const MOLDURA = 28;

/** Topo da região de assinaturas/rodapé na página 1 (medido de baixo para cima). */
export const TOPO_ASSINATURAS = 172;
/**
 * Folga entre o fim do texto e TOPO_ASSINATURAS: linha "Rondonópolis, data" (que fica
 * logo acima das assinaturas) + aviso "na página seguinte".
 */
export const FOLGA_TEXTO = 44;

export const LARGURA_PRINCIPAL = AREA - 60;
export const LARGURA_EXTRA = AREA - 100;
export const ESP_PRINCIPAL = 1.5;
export const ESP_EXTRA = 1.4;
const TAMANHOS_PRINCIPAL = [14, 13, 12, 11];
const TAMANHOS_EXTRA = [10.5, 10, 9.5, 9];
const TAMANHO_MIN_PRINCIPAL = 9;
const TAMANHOS_NOME = [28, 26, 24, 22, 20, 18, 16];

/** Mede texto: `(tamanho, negrito) => (texto) => largura`. */
export type Medidor = (tamanho: number, negrito: boolean) => (s: string) => number;

export type CorTexto = "texto" | "cinza" | "azul";

/** Uma linha centralizada, com a posição (baseline) onde será desenhada. */
export type LinhaPlanejada = { y: number; tamanho: number; cor: CorTexto; trechos: Trecho[] };

export type PlanoTexto = {
  linhas: LinhaPlanejada[];
  /** certificado_texto que não coube na página 1 ("Informações complementares"). */
  extraEmPagina: string | null;
  /** Posição (y) logo abaixo do último texto da página 1. */
  yFinal: number;
  tamanhoNome: number;
};

export type EntradaPlano = {
  nome: string;
  documento: string | null;
  paragrafo: Segmento[];
  extra: string | null;
};

/** Linhas do nome em destaque: 1 linha no maior tamanho que couber; senão, 2 ou mais linhas em 22. */
export function planejarNome(nome: string, medir: Medidor, largura = AREA - 80) {
  for (const t of TAMANHOS_NOME) {
    if (medir(t, true)(nome) <= largura) return { tamanho: t, linhas: [nome] };
  }
  return { tamanho: 20, linhas: quebrarLinhas(nome, largura, medir(20, true)) };
}

/**
 * Decide tamanhos e posições de TODO o texto da página 1 antes de desenhar, para
 * nada passar por cima das assinaturas. Encolhe parágrafo e texto adicional até um
 * mínimo legível; se ainda não couber, o texto adicional (oficial, não pode ser
 * cortado) vai inteiro para uma página extra.
 * `yInicio` é o y logo abaixo do título "CERTIFICADO".
 */
export function planejarTexto(entrada: EntradaPlano, yInicio: number, medir: Medidor): PlanoTexto {
  const limite = TOPO_ASSINATURAS + FOLGA_TEXTO;
  const linhas: LinhaPlanejada[] = [];
  let y = yInicio;

  const empilhar = (
    trechos: Trecho[][],
    tamanho: number,
    esp: number,
    cor: CorTexto,
  ): LinhaPlanejada[] =>
    trechos.map((t) => {
      y -= tamanho * esp;
      return { y, tamanho, cor, trechos: t };
    });
  const normal = (t: string): Trecho[] => [{ texto: t, negrito: false }];

  // Bloco fixo: "Certificamos que", nome e documento.
  linhas.push(...empilhar([normal("Certificamos que")], 13, 1.4, "texto"));
  y -= 6;
  const nome = planejarNome(entrada.nome, medir);
  linhas.push(
    ...empilhar(
      nome.linhas.map((l) => [{ texto: l, negrito: true }]),
      nome.tamanho,
      1.2,
      "azul",
    ),
  );
  if (entrada.documento) {
    y -= 2;
    linhas.push(...empilhar([normal(entrada.documento)], 11, 1.3, "cinza"));
  }
  y -= 10;
  const yAposFixo = y;
  const base = { tamanhoNome: nome.tamanho };

  const medirSeg = (t: number) => (s: string, negrito: boolean) => medir(t, negrito)(s);
  const paragrafo = (tp: number) => quebrarSegmentos(entrada.paragrafo, LARGURA_PRINCIPAL, medirSeg(tp));

  const montar = (tp: number, extra: { te: number; linhasExtra: string[] } | null, extraEmPagina: string | null) => {
    y = yAposFixo;
    const resultado = [...linhas, ...empilhar(paragrafo(tp), tp, ESP_PRINCIPAL, "texto")];
    if (extra) {
      y -= 8;
      resultado.push(...empilhar(extra.linhasExtra.map(normal), extra.te, ESP_EXTRA, "cinza"));
    }
    return { linhas: resultado, extraEmPagina, yFinal: y, ...base };
  };

  for (const tp of TAMANHOS_PRINCIPAL) {
    const alturaP = paragrafo(tp).length * tp * ESP_PRINCIPAL;
    if (yAposFixo - alturaP < limite) continue;
    if (!entrada.extra) return montar(tp, null, null);
    for (const te of TAMANHOS_EXTRA) {
      const linhasExtra = quebrarLinhas(entrada.extra, LARGURA_EXTRA, medir(te, false));
      if (yAposFixo - alturaP - 8 - linhasExtra.length * te * ESP_EXTRA >= limite) {
        return montar(tp, { te, linhasExtra }, null);
      }
    }
  }

  // Não coube nem no menor tamanho: o texto adicional vai para páginas extras
  // e o parágrafo usa o maior tamanho em que caiba (mínimo 9).
  let tp = TAMANHOS_PRINCIPAL[0];
  for (;;) {
    const alturaP = paragrafo(tp).length * tp * ESP_PRINCIPAL;
    if (yAposFixo - alturaP >= limite || tp <= TAMANHO_MIN_PRINCIPAL) {
      return montar(tp, null, entrada.extra);
    }
    tp -= 1;
  }
}
