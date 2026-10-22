import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { formatarCargaHoraria, formatarData, formatarHora } from "@/lib/datas";
import { ROTULO_TIPO_ATIVIDADE, type TipoAtividade } from "@/lib/tipos";
import { periodoPorExtenso } from "./data-extenso";
import {
  ALTURA,
  AREA,
  LARGURA,
  MARGEM,
  MOLDURA,
  planejarTexto,
  TOPO_ASSINATURAS,
  type CorTexto,
} from "./layout";
import { LOGO_UFR_PNG_BASE64 } from "./logo-ufr";
import { quebrarLinhas, quebrarSegmentos } from "./quebra-linha";
import { linhaLocalEData, paragrafoPrincipal } from "./texto";
import type { DadosCertificado } from "./tipos";
import { paraWinAnsi, paraWinAnsiTrecho } from "./winansi";

const AZUL_MARINHO = rgb(0x22 / 255, 0x37 / 255, 0x6b / 255);
const AZUL = rgb(0x08 / 255, 0x6a / 255, 0xb1 / 255);
const VERDE = rgb(0x53 / 255, 0xb3 / 255, 0x66 / 255);
const TEXTO = rgb(0.1, 0.1, 0.12);
const CINZA = rgb(0.38, 0.4, 0.45);

const COR: Record<CorTexto, typeof TEXTO> = { texto: TEXTO, cinza: CINZA, azul: AZUL_MARINHO };

/** Mais que isso vai para a página "Atividades do evento". */
const MAX_ATIVIDADES_NA_PAGINA_1 = 4;
const ALTURA_LINHA_ATIVIDADE = 13;

type Fontes = { normal: PDFFont; negrito: PDFFont };

export function obterSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

const larguraDe = (f: Fontes, tamanho: number, negrito: boolean) => (s: string) =>
  (negrito ? f.negrito : f.normal).widthOfTextAtSize(s, tamanho);

/** Moldura fina e triângulos nas cores da UFR em dois cantos (superior direito e inferior esquerdo). */
function moldura(page: PDFPage) {
  page.drawRectangle({
    x: MOLDURA,
    y: MOLDURA,
    width: LARGURA - 2 * MOLDURA,
    height: ALTURA - 2 * MOLDURA,
    borderColor: AZUL_MARINHO,
    borderWidth: 1,
  });
  // drawSvgPath tem o eixo y para baixo, a partir do ponto (x, y) dado.
  const triangulos: [typeof TEXTO, number, number][] = [
    [AZUL_MARINHO, 96, 66],
    [AZUL, 76, 52],
    [VERDE, 56, 38],
  ];
  for (const [cor, ladoSup, ladoInf] of triangulos) {
    page.drawSvgPath(`M 0 0 L ${-ladoSup} 0 L 0 ${ladoSup} Z`, {
      x: LARGURA - MOLDURA,
      y: ALTURA - MOLDURA,
      color: cor,
      borderWidth: 0,
    });
    page.drawSvgPath(`M 0 0 L ${ladoInf} 0 L 0 ${-ladoInf} Z`, {
      x: MOLDURA,
      y: MOLDURA,
      color: cor,
      borderWidth: 0,
    });
  }
}

/** Desenha moldura, logo (opcional) e devolve o y logo abaixo dele. */
function cabecalho(page: PDFPage, logo: PDFImage | null): number {
  moldura(page);
  let topo = ALTURA - MOLDURA - 14;
  if (logo) {
    const h = 52;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: (LARGURA - w) / 2, y: topo - h, width: w, height: h });
    topo -= h + 4;
  }
  return topo;
}

function centralizado(
  page: PDFPage,
  texto: string,
  y: number,
  fonte: PDFFont,
  tamanho: number,
  cor = TEXTO,
  largura = AREA,
  espacamento = 1.4,
): number {
  const linhas = quebrarLinhas(paraWinAnsi(texto), largura, (s) => fonte.widthOfTextAtSize(s, tamanho));
  for (const linha of linhas) {
    y -= tamanho * espacamento;
    const w = fonte.widthOfTextAtSize(linha, tamanho);
    page.drawText(linha, { x: (LARGURA - w) / 2, y, size: tamanho, font: fonte, color: cor });
  }
  return y;
}

type Linha = { titulo: string[]; data: string; horas: string };

function linhasDeAtividades(d: DadosCertificado, f: Fontes, tamanho: number): Linha[] {
  const larguraTitulo = AREA - 190;
  return d.atividades.map((a) => ({
    titulo: quebrarLinhas(paraWinAnsi(a.titulo), larguraTitulo, larguraDe(f, tamanho, false)),
    data: a.inicio ? formatarData(a.inicio) : "",
    horas: formatarCargaHoraria(a.carga_horaria_minutos),
  }));
}

const alturaDaLinha = (l: Linha) => Math.max(1, l.titulo.length) * ALTURA_LINHA_ATIVIDADE + 4;

function desenharLinhaAtividade(page: PDFPage, f: Fontes, l: Linha, y: number, tamanho: number): number {
  const xData = MARGEM + AREA - 190 + 10;
  const xHoras = MARGEM + AREA - 70;
  l.titulo.forEach((t, i) => {
    page.drawText(i === 0 ? `• ${t}` : `  ${t}`, {
      x: MARGEM,
      y: y - ALTURA_LINHA_ATIVIDADE * (i + 1) + 3,
      size: tamanho,
      font: f.normal,
      color: TEXTO,
    });
  });
  const yPrimeira = y - ALTURA_LINHA_ATIVIDADE + 3;
  page.drawText(l.data, { x: xData, y: yPrimeira, size: tamanho, font: f.normal, color: CINZA });
  page.drawText(paraWinAnsi(l.horas), { x: xHoras, y: yPrimeira, size: tamanho, font: f.normal, color: CINZA });
  return y - alturaDaLinha(l);
}

function assinaturas(page: PDFPage, f: Fontes, d: DadosCertificado) {
  const lista = d.certificado_assinaturas.slice(0, 3);
  if (lista.length === 0) return;
  const coluna = AREA / lista.length;
  const larguraLinha = Math.min(210, coluna - 24);
  lista.forEach((a, i) => {
    const centro = MARGEM + coluna * i + coluna / 2;
    const yLinha = TOPO_ASSINATURAS - 22;
    page.drawLine({
      start: { x: centro - larguraLinha / 2, y: yLinha },
      end: { x: centro + larguraLinha / 2, y: yLinha },
      thickness: 0.8,
      color: TEXTO,
    });
    let y = yLinha;
    const escrever = (txt: string, fonte: PDFFont, tam: number, cor: typeof TEXTO, max: number) => {
      for (const linha of quebrarLinhas(paraWinAnsi(txt), larguraLinha + 20, (s) => fonte.widthOfTextAtSize(s, tam)).slice(0, max)) {
        y -= tam + 3;
        const w = fonte.widthOfTextAtSize(linha, tam);
        page.drawText(linha, { x: centro - w / 2, y, size: tam, font: fonte, color: cor });
      }
    };
    escrever(a.nome, f.negrito, 11, TEXTO, 2);
    escrever(a.cargo, f.normal, 9.5, CINZA, 2);
  });
}

async function rodape(page: PDFPage, f: Fontes, d: DadosCertificado, siteUrl: string, doc: PDFDocument) {
  const qrPng = await QRCode.toBuffer(`${siteUrl}/certificados/${d.codigo}`, {
    type: "png",
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
  });
  const qr = await doc.embedPng(qrPng);
  const lado = 64;
  const yBase = 36;
  const xQr = 98; // afastado do triângulo do canto inferior esquerdo
  page.drawImage(qr, { x: xQr, y: yBase, width: lado, height: lado });

  const x = xQr + lado + 12;
  let y = yBase + lado - 10;
  page.drawText(paraWinAnsi(`Código de validação: ${d.codigo}`), { x, y, size: 11, font: f.negrito, color: AZUL_MARINHO });
  y -= 14;
  page.drawText(paraWinAnsi(`Confira em ${siteUrl}/certificados/validar`), { x, y, size: 9, font: f.normal, color: CINZA });
  if (d.certificado_registro) {
    const linhas = quebrarLinhas(paraWinAnsi(`Registro: ${d.certificado_registro}`), AREA - lado - 230, (s) =>
      f.normal.widthOfTextAtSize(s, 9),
    ).slice(0, 2);
    for (const linha of linhas) {
      y -= 12;
      page.drawText(linha, { x, y, size: 9, font: f.normal, color: CINZA });
    }
  }
  const emissao = paraWinAnsi(`Emitido em ${formatarData(d.emitido_em)}`);
  const w = f.normal.widthOfTextAtSize(emissao, 9);
  page.drawText(emissao, { x: LARGURA - MARGEM - w, y: yBase + 4, size: 9, font: f.normal, color: CINZA });
}

function rodapeContinuacao(page: PDFPage, f: Fontes, d: DadosCertificado, n: number, total: number) {
  const txt = paraWinAnsi(`Código de validação: ${d.codigo}  -  Página ${n} de ${total}`);
  const w = f.normal.widthOfTextAtSize(txt, 9);
  page.drawText(txt, { x: (LARGURA - w) / 2, y: 40, size: 9, font: f.normal, color: CINZA });
}

/** Página nova com moldura e título; devolve o y onde o conteúdo começa. */
function paginaExtra(doc: PDFDocument, f: Fontes, titulo: string): { page: PDFPage; y: number } {
  const page = doc.addPage([LARGURA, ALTURA]);
  const topo = cabecalho(page, null);
  page.drawText(paraWinAnsi(titulo), { x: MARGEM, y: topo - 24, size: 16, font: f.negrito, color: AZUL_MARINHO });
  return { page, y: topo - 40 };
}

/** Gera o certificado em PDF (A4 paisagem). Nunca lança por causa de caracteres estranhos no texto. */
export async function gerarPdfCertificado(
  dados: DadosCertificado,
  opcoes: { siteUrl?: string } = {},
): Promise<Uint8Array> {
  const siteUrl = (opcoes.siteUrl ?? obterSiteUrl()).replace(/\/+$/, "");
  const doc = await PDFDocument.create();
  const f: Fontes = {
    normal: await doc.embedFont(StandardFonts.Helvetica),
    negrito: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = await doc.embedPng(Buffer.from(LOGO_UFR_PNG_BASE64, "base64"));

  doc.setTitle(paraWinAnsi(`Certificado ${dados.codigo}`));
  doc.setProducer("Plataforma de eventos UFR");
  doc.setCreator("Plataforma de eventos UFR");

  // ---------- Página 1 ----------
  const p1 = doc.addPage([LARGURA, ALTURA]);
  let y = cabecalho(p1, logo);
  y = centralizado(p1, "CERTIFICADO", y, f.negrito, 30, AZUL_MARINHO);

  const plano = planejarTexto(
    {
      nome: paraWinAnsi(dados.nome).toLocaleUpperCase("pt-BR"),
      documento: dados.documento ? paraWinAnsi(dados.documento) : null,
      paragrafo: paragrafoPrincipal(dados).map((s) => ({ ...s, texto: paraWinAnsiTrecho(s.texto) })),
      extra: dados.certificado_texto ? paraWinAnsi(dados.certificado_texto) : null,
    },
    y - 6,
    (t, negrito) => larguraDe(f, t, negrito),
  );
  for (const linha of plano.linhas) {
    const medir = (tr: { texto: string; negrito: boolean }) => larguraDe(f, linha.tamanho, tr.negrito)(tr.texto);
    let x = (LARGURA - linha.trechos.reduce((s, tr) => s + medir(tr), 0)) / 2;
    for (const tr of linha.trechos) {
      p1.drawText(tr.texto, {
        x,
        y: linha.y,
        size: linha.tamanho,
        font: tr.negrito ? f.negrito : f.normal,
        color: COR[linha.cor],
      });
      x += medir(tr);
    }
  }
  y = plano.yFinal;
  if (plano.extraEmPagina) {
    y = centralizado(p1, "As informações complementares estão nas páginas seguintes.", y - 4, f.normal, 10, CINZA);
  }

  // Atividades (só participante): até 4 na página 1, se couberem; senão, página "Atividades do evento".
  const TAM = 10;
  const ehParticipante = dados.tipo === "participante";
  const poucas = dados.atividades.length > 0 && dados.atividades.length <= MAX_ATIVIDADES_NA_PAGINA_1;
  let atividadesNaPagina2 = false;
  if (ehParticipante && dados.atividades.length > 0) {
    const linhas = linhasDeAtividades(dados, f, TAM);
    const necessario = linhas.reduce((s, l) => s + alturaDaLinha(l), 0) + 32;
    const disponivel = y - (TOPO_ASSINATURAS + 26);
    if (poucas && necessario <= disponivel) {
      y -= 14;
      p1.drawText("Atividades realizadas", { x: MARGEM, y: y - 4, size: 11, font: f.negrito, color: AZUL_MARINHO });
      y -= 18;
      for (const l of linhas) y = desenharLinhaAtividade(p1, f, l, y, TAM);
    } else {
      atividadesNaPagina2 = true;
      centralizado(p1, "As atividades do evento estão na página seguinte.", y - 4, f.normal, 10, CINZA);
    }
  }

  // Local e data de emissão, logo acima das assinaturas.
  const local = paraWinAnsi(linhaLocalEData(dados.emitido_em));
  const wLocal = f.normal.widthOfTextAtSize(local, 11);
  p1.drawText(local, { x: (LARGURA - wLocal) / 2, y: TOPO_ASSINATURAS + 6, size: 11, font: f.normal, color: TEXTO });

  assinaturas(p1, f, dados);
  await rodape(p1, f, dados, siteUrl, doc);

  // ---------- Páginas extras ----------
  const extras: PDFPage[] = [];

  if (atividadesNaPagina2) {
    const limite = 62;
    let i = 0;
    let primeira = true;
    while (i < dados.atividades.length) {
      const nova = paginaExtra(doc, f, primeira ? "Atividades do evento" : "Atividades do evento (continuação)");
      extras.push(nova.page);
      let yy = nova.y;
      // Contexto no topo: evento, período e local.
      for (const linha of quebrarLinhas(paraWinAnsi(dados.evento_titulo), AREA - 130, larguraDe(f, 12, true)).slice(0, 2)) {
        nova.page.drawText(linha, { x: MARGEM, y: yy, size: 12, font: f.negrito, color: TEXTO });
        yy -= 15;
      }
      const periodo = periodoPorExtenso(dados.data_inicio, dados.data_fim);
      const contexto = `${periodo.charAt(0).toUpperCase()}${periodo.slice(1)}${dados.evento_local ? ` - ${dados.evento_local}` : ""}`;
      nova.page.drawText(paraWinAnsi(contexto), { x: MARGEM, y: yy, size: 10, font: f.normal, color: CINZA });
      yy -= 24;
      primeira = false;

      let naPagina = 0;
      while (i < dados.atividades.length) {
        const a = dados.atividades[i];
        const rotulo = `${ROTULO_TIPO_ATIVIDADE[a.tipo as TipoAtividade] ?? "Atividade"}: `;
        const trechos = quebrarSegmentos(
          [{ texto: paraWinAnsiTrecho(rotulo), negrito: true }, { texto: paraWinAnsi(a.titulo) }],
          AREA,
          (s, negrito) => larguraDe(f, 11, negrito)(s),
        );
        const altura = trechos.length * 14 + 2 * 13 + 10;
        if (naPagina > 0 && yy - altura < limite) break;
        for (const linha of trechos) {
          yy -= 14;
          let x = MARGEM;
          for (const tr of linha) {
            nova.page.drawText(tr.texto, { x, y: yy, size: 11, font: tr.negrito ? f.negrito : f.normal, color: TEXTO });
            x += larguraDe(f, 11, tr.negrito)(tr.texto);
          }
        }
        const quando = a.inicio
          ? `${formatarData(a.inicio)} – ${formatarHora(a.inicio)}${a.fim ? ` às ${formatarHora(a.fim)}` : ""}`
          : "-";
        nova.page.drawText(paraWinAnsi(`Data e horário: ${quando}`), { x: MARGEM, y: yy - 13, size: 10, font: f.normal, color: CINZA });
        nova.page.drawText(paraWinAnsi(`Carga horária: ${formatarCargaHoraria(a.carga_horaria_minutos)}`), { x: MARGEM, y: yy - 26, size: 10, font: f.normal, color: CINZA });
        yy -= 2 * 13 + 10;
        i++;
        naPagina++;
      }
    }
  }

  if (plano.extraEmPagina) {
    const linhasExtra = quebrarLinhas(plano.extraEmPagina, AREA, larguraDe(f, 11, false));
    let k = 0;
    while (k < linhasExtra.length) {
      const nova = paginaExtra(doc, f, "Informações complementares");
      extras.push(nova.page);
      let yy = nova.y - 8;
      while (k < linhasExtra.length && yy - 16 >= 62) {
        yy -= 16;
        nova.page.drawText(linhasExtra[k], { x: MARGEM, y: yy, size: 11, font: f.normal, color: TEXTO });
        k++;
      }
    }
  }

  const total = 1 + extras.length;
  extras.forEach((p, k) => rodapeContinuacao(p, f, dados, k + 2, total));

  return doc.save();
}
