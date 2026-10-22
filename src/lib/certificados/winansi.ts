// As fontes padrão do PDF (Helvetica) só cobrem WinAnsi (Windows-1252). Qualquer
// caractere fora dele faz o pdf-lib lançar erro; aqui trocamos por algo seguro.

const ESPECIAIS_CP1252 = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
]);

function cabeNoWinAnsi(cp: number): boolean {
  if (cp >= 0x20 && cp <= 0x7e) return true;
  if (cp >= 0xa1 && cp <= 0xff && cp !== 0xad) return true;
  return cp === 0xa0 || ESPECIAIS_CP1252.has(cp);
}

const SUBSTITUTOS: Record<string, string> = {
  "­": "-",
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "―": "-",
  "−": "-",
  "‛": "'",
  "′": "'",
  "‟": '"',
  "″": '"',
  "Ø": "O",
  "Ł": "L",
  "ł": "l",
  "ı": "i",
  "→": "->",
};

/**
 * Deixa o texto seguro para a fonte padrão: normaliza (NFC), tira caracteres de
 * controle e invisíveis, tenta remover o acento do que não existe em WinAnsi e,
 * em último caso, usa "?". Acentos do português passam intactos.
 */
export function paraWinAnsi(texto: string): string {
  return paraWinAnsiTrecho(texto).trim();
}

/**
 * Igual a paraWinAnsi, mas SEM aparar as pontas: para trechos de um parágrafo
 * com negrito, em que o espaço no fim de "do evento " separa a palavra seguinte.
 */
export function paraWinAnsiTrecho(texto: string): string {
  let saida = "";
  for (const ch of texto.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x09 || cp === 0x0a || cp === 0x0d) {
      saida += " ";
    } else if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f) || (cp >= 0x200b && cp <= 0x200f) || cp === 0xfeff || (cp >= 0xfe00 && cp <= 0xfe0f)) {
      continue; // controle, zero-width, seletores de variação
    } else if (cabeNoWinAnsi(cp)) {
      saida += ch;
    } else if (SUBSTITUTOS[ch]) {
      saida += SUBSTITUTOS[ch];
    } else {
      const base = ch.normalize("NFD").replace(/\p{Diacritic}/gu, "");
      saida += base.length > 0 && [...base].every((c) => cabeNoWinAnsi(c.codePointAt(0)!)) ? base : "?";
    }
  }
  return saida.replace(/ {2,}/g, " ");
}
