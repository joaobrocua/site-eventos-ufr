import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Download, ShieldX } from "lucide-react";
import {
  formatarCargaHoraria,
  formatarData,
  formatarDiaLongo,
  formatarHora,
  formatarPeriodo,
} from "@/lib/datas";
import {
  codigoCertificadoValido,
  foiAtualizado,
  lerAtividadesCertificado,
  normalizarCodigoCertificado,
} from "@/lib/inscricao/certificados";
import { createClient } from "@/lib/supabase/server";
import { ROTULO_TIPO_CERTIFICADO, type TipoCertificado } from "@/lib/tipos";
import { Button } from "@/components/ui/button";

// A página mostra o nome da pessoa: não deve aparecer em buscadores.
export const metadata: Metadata = {
  title: "Validação de certificado",
  robots: { index: false, follow: false },
};

function dataHora(v: string) {
  return `${formatarData(v)} às ${formatarHora(v)}`;
}

type Linha = [string, string];

export default async function PaginaCertificado({ params }: PageProps<"/certificados/[codigo]">) {
  const { codigo: bruto } = await params;
  // % malformado na URL lança URIError: trata como código inexistente.
  let decodificado: string;
  try {
    decodificado = decodeURIComponent(bruto);
  } catch {
    notFound();
  }
  const codigo = normalizarCodigoCertificado(decodificado);
  if (!codigoCertificadoValido(codigo)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validar_certificado", { p_codigo: codigo });
  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p role="alert" className="text-destructive">
          Não foi possível consultar o certificado agora. Tente novamente em instantes.
        </p>
      </div>
    );
  }
  const c = data?.[0];
  if (!c) notFound();

  const revogado = !!c.revogado_em;
  const atividades = lerAtividadesCertificado(c.atividades);
  const linhas: Linha[] = [
    ["Nome", c.nome],
    ["Tipo", ROTULO_TIPO_CERTIFICADO[c.tipo as TipoCertificado] ?? c.tipo],
  ];
  if (c.documento_mascarado) linhas.push(["Documento", c.documento_mascarado]);
  if (c.funcao) linhas.push(["Função", c.funcao]);
  linhas.push(["Evento", c.evento_titulo], ["Período", formatarPeriodo(c.data_inicio, c.data_fim)]);
  if (c.evento_local) linhas.push(["Local", c.evento_local]);
  linhas.push(
    ["Carga horária", formatarCargaHoraria(c.carga_horaria_minutos)],
    ["Código", c.codigo],
    ["Emitido em", dataHora(c.emitido_em)],
  );
  if (foiAtualizado(c.emitido_em, c.atualizado_em)) {
    linhas.push(["Atualizado em", dataHora(c.atualizado_em)]);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:py-12">
      {revogado ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-5"
        >
          <ShieldX className="size-9 shrink-0 text-destructive" aria-hidden />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-destructive">Certificado revogado</h1>
            <p>Revogado em {dataHora(c.revogado_em!)}.</p>
            {c.revogado_motivo && <p>Motivo: {c.revogado_motivo}</p>}
          </div>
        </div>
      ) : (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 p-5"
        >
          <BadgeCheck className="size-9 shrink-0 text-success" aria-hidden />
          <h1 className="text-2xl font-semibold text-success">Certificado válido</h1>
        </div>
      )}

      <dl className="divide-y rounded-xl border bg-card">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm text-muted-foreground">{rotulo}</dt>
            <dd className="font-medium sm:col-span-2">{valor}</dd>
          </div>
        ))}
      </dl>

      {atividades.length > 0 && (
        <section aria-labelledby="titulo-atividades" className="space-y-3">
          <h2 id="titulo-atividades" className="text-lg font-semibold">
            Atividades
          </h2>
          <ul className="space-y-2">
            {atividades.map((a, i) => (
              <li key={`${a.titulo}-${i}`} className="rounded-lg border p-3">
                <p className="font-medium">{a.titulo}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="inline-block first-letter:uppercase">{formatarDiaLongo(a.inicio)}</span>
                  , {formatarHora(a.inicio)} · {formatarCargaHoraria(a.carga_horaria_minutos)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!revogado && (
        <div className="space-y-2">
          <Button
            className="h-11 text-base"
            render={<a href={`/certificados/${c.codigo}/pdf`} />}
            nativeButton={false}
          >
            <Download aria-hidden />
            Baixar PDF
          </Button>
          <p className="text-sm text-muted-foreground">
            Disponível para o titular e para a organização (é preciso entrar na conta).
          </p>
        </div>
      )}

      <p className="text-sm">
        <Link href="/certificados/validar" className="text-primary underline underline-offset-4">
          Validar outro certificado
        </Link>
      </p>
    </div>
  );
}
