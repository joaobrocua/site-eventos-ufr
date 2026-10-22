/**
 * Quebra o texto em linhas que cabem em `largura`, medindo com `medir`
 * (ex.: `(s) => font.widthOfTextAtSize(s, tamanho)`). Palavras maiores que a
 * linha são cortadas.
 */
export function quebrarLinhas(texto: string, largura: number, medir: (s: string) => number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (medir(tentativa) <= largura) {
        atual = tentativa;
        continue;
      }
      if (atual) linhas.push(atual);
      atual = "";
      let resto = palavra;
      while (medir(resto) > largura && resto.length > 1) {
        let n = resto.length - 1;
        while (n > 1 && medir(resto.slice(0, n)) > largura) n--;
        linhas.push(resto.slice(0, n));
        resto = resto.slice(n);
      }
      atual = resto;
    }
    linhas.push(atual);
  }
  return linhas;
}

/** Trecho de texto com ou sem negrito (o PDF não tem rich text: desenhamos trecho a trecho). */
export type Segmento = { texto: string; negrito?: boolean };
export type Trecho = { texto: string; negrito: boolean };

type Peca = { texto: string; negrito: boolean; espacoAntes: boolean };

function pecasDe(segmentos: Segmento[]): Peca[] {
  const pecas: Peca[] = [];
  let espaco = false;
  for (const seg of segmentos) {
    for (const tok of seg.texto.split(/(\s+)/)) {
      if (tok === "") continue;
      if (/^\s+$/.test(tok)) {
        espaco = true;
        continue;
      }
      pecas.push({ texto: tok, negrito: !!seg.negrito, espacoAntes: espaco && pecas.length > 0 });
      espaco = false;
    }
  }
  return pecas;
}

/**
 * Quebra segmentos (normal/negrito) em linhas que cabem em `largura`. Cada linha
 * volta como trechos já com os espaços; pontuação colada a um trecho em negrito
 * (ex.: `**TÍTULO**,`) nunca é separada dele.
 */
export function quebrarSegmentos(
  segmentos: Segmento[],
  largura: number,
  medir: (texto: string, negrito: boolean) => number,
): Trecho[][] {
  // unidade = peças coladas (sem espaço entre elas)
  const unidades: Peca[][] = [];
  for (const p of pecasDe(segmentos)) {
    if (p.espacoAntes || unidades.length === 0) unidades.push([p]);
    else unidades[unidades.length - 1].push(p);
  }

  const espaco = medir(" ", false);
  const linhas: Peca[][] = [];
  let atual: Peca[] = [];
  let w = 0;
  const fechar = () => {
    if (atual.length > 0) linhas.push(atual);
    atual = [];
    w = 0;
  };

  for (const u of unidades) {
    const uw = u.reduce((s, p) => s + medir(p.texto, p.negrito), 0);
    const extra = atual.length > 0 ? espaco + uw : uw;
    if (w + extra <= largura) {
      atual.push({ ...u[0], espacoAntes: atual.length > 0 }, ...u.slice(1));
      w += extra;
      continue;
    }
    fechar();
    if (uw <= largura) {
      atual.push({ ...u[0], espacoAntes: false }, ...u.slice(1));
      w = uw;
      continue;
    }
    // Unidade maior que a linha: corta caractere a caractere.
    for (const p of u) {
      let resto = p.texto;
      while (resto.length > 0) {
        let n = resto.length;
        while (n > 1 && w + medir(resto.slice(0, n), p.negrito) > largura) n--;
        if (w + medir(resto.slice(0, n), p.negrito) > largura && atual.length > 0) {
          fechar();
          continue;
        }
        atual.push({ texto: resto.slice(0, n), negrito: p.negrito, espacoAntes: false });
        w += medir(resto.slice(0, n), p.negrito);
        resto = resto.slice(n);
        if (resto.length > 0) fechar();
      }
    }
  }
  fechar();

  return linhas.map((pecas) => {
    const trechos: Trecho[] = [];
    for (const p of pecas) {
      const t = (p.espacoAntes ? " " : "") + p.texto;
      const ultimo = trechos[trechos.length - 1];
      if (ultimo && ultimo.negrito === p.negrito) ultimo.texto += t;
      else trechos.push({ texto: t, negrito: p.negrito });
    }
    return trechos;
  });
}
