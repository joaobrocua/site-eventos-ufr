"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatarHora } from "@/lib/datas";
import type { ResultadoTela } from "@/lib/presenca/tipos";

type Props = {
  resultado: ResultadoTela | null;
  enviando: boolean;
  onContinuar: () => void;
  onIncluir: () => void;
  /** Sobrepõe o elemento pai (modo câmera). */
  sobreposto?: boolean;
};

type Visual = {
  cor: string;
  Icone: typeof CheckCircle2;
  titulo: string;
  detalhe?: string;
};

function visualDe(r: ResultadoTela): Visual {
  const verde = "bg-success text-white";
  const amarelo = "bg-warning text-foreground";
  const vermelho = "bg-destructive text-white";
  switch (r.tipo) {
    case "registrado":
      return { cor: verde, Icone: CheckCircle2, titulo: "Presença registrada" };
    case "ja_registrado":
      return {
        cor: amarelo,
        Icone: AlertTriangle,
        titulo: r.dados.presenteEm
          ? `Já estava registrado às ${formatarHora(r.dados.presenteEm)}`
          : "Já estava registrado",
      };
    case "nao_inscrito":
      return { cor: vermelho, Icone: XCircle, titulo: "Não está inscrito nesta atividade" };
    case "inscricao_cancelada":
      return {
        cor: vermelho,
        Icone: XCircle,
        titulo: "Inscrição cancelada",
        detalhe: "Esta pessoa cancelou a inscrição no evento.",
      };
    case "codigo_invalido":
      return {
        cor: vermelho,
        Icone: XCircle,
        titulo: "Código não encontrado",
        detalhe: "Este código não pertence a este evento.",
      };
    case "qr_invalido":
      return {
        cor: vermelho,
        Icone: XCircle,
        titulo: "QR code não reconhecido",
        detalhe: "Este QR code não é de uma inscrição. Tente outro.",
      };
    case "erro":
      return { cor: vermelho, Icone: XCircle, titulo: "Não foi possível registrar", detalhe: r.mensagem };
  }
}

/** Painel grande e colorido com o resultado da leitura. A região é aria-live para leitores de tela. */
export function PainelResultado({ resultado, enviando, onContinuar, onIncluir, sobreposto }: Props) {
  const visual = resultado ? visualDe(resultado) : null;
  const dados = resultado && "dados" in resultado ? resultado.dados : null;

  return (
    <div
      aria-live="polite"
      className={cn(sobreposto && "pointer-events-none absolute inset-0 z-10", !resultado && !sobreposto && "hidden")}
    >
      {resultado && visual && (
        <div
          className={cn(
            "pointer-events-auto flex flex-col justify-center gap-4 p-5 text-center",
            sobreposto ? "h-full overflow-auto" : "min-h-56 rounded-xl",
            visual.cor,
          )}
        >
          <visual.Icone className="mx-auto size-16" aria-hidden />
          <p className="text-2xl leading-tight font-bold">{visual.titulo}</p>
          {dados?.nome && (
            <div>
              <p className="text-xl font-semibold">{dados.nome}</p>
              {dados.rga && <p className="text-lg opacity-90">RGA {dados.rga}</p>}
            </div>
          )}
          {visual.detalhe && <p className="text-lg">{visual.detalhe}</p>}

          {resultado.tipo === "nao_inscrito" ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                className="h-14 w-full text-base font-semibold"
                onClick={onIncluir}
                disabled={enviando}
              >
                {enviando ? "Registrando..." : "Inscrever e registrar presença"}
              </Button>
              <Button
                variant="ghost"
                className="h-12 w-full text-base text-white hover:bg-white/20 hover:text-white"
                onClick={onContinuar}
                disabled={enviando}
              >
                Cancelar e ler outro
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className={cn(
                "mx-auto h-12 px-6 text-base",
                resultado.tipo === "ja_registrado"
                  ? "hover:bg-black/10"
                  : "text-white hover:bg-white/20 hover:text-white",
              )}
              onClick={onContinuar}
            >
              Continuar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
