"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { CameraOff } from "lucide-react";
import type { IScannerError } from "@yudiel/react-qr-scanner";
import { Button } from "@/components/ui/button";
import { PainelResultado } from "./painel-resultado";
import type { useRegistroPresenca } from "./use-registro-presenca";

// A leitura de QR depende de APIs do navegador: nunca roda no servidor.
// O WebAssembly do leitor vem do próprio site (public/zxing/, copiado no
// postinstall), e não do CDN padrão da biblioteca: a CSP só libera a origem do site.
const Scanner = dynamic(
  () =>
    import("@yudiel/react-qr-scanner").then((m) => {
      m.setZXingModuleOverrides({
        locateFile: (caminho: string, prefixo: string) =>
          caminho.endsWith(".wasm") ? "/zxing/zxing_reader.wasm" : prefixo + caminho,
      });
      return m.Scanner;
    }),
  {
    ssr: false,
    loading: () => <div className="aspect-square w-full animate-pulse rounded-xl bg-muted" />,
  },
);

type Props = {
  registro: ReturnType<typeof useRegistroPresenca>;
  onUsarLista: () => void;
};

function mensagemDoErroDeCamera(erro: IScannerError): string {
  switch (erro.kind) {
    case "permission-denied":
    case "security":
      return "O acesso à câmera foi bloqueado. Permita o uso da câmera nas configurações do navegador e tente de novo.";
    case "no-camera":
      return "Não encontramos uma câmera neste aparelho.";
    case "in-use":
      return "A câmera está sendo usada por outro aplicativo. Feche-o e tente de novo.";
    case "insecure-context":
      return "No celular, a câmera só funciona se o site for aberto por https.";
    case "unsupported":
      return "Este navegador não consegue ler QR code pela câmera.";
    default:
      return "Não foi possível abrir a câmera.";
  }
}

const semInscricao = () => () => {};

export function ModoCamera({ registro, onUsarLista }: Props) {
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  // Verdadeiro no servidor (não há como saber); no navegador, o valor real.
  const contextoSeguro = useSyncExternalStore(
    semInscricao,
    () => window.isSecureContext,
    () => true,
  );

  const mensagem = !contextoSeguro
    ? "No celular, a câmera só funciona se o site for aberto por https. Peça o endereço seguro (https://) ou use a lista."
    : erro;

  if (mensagem) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center">
        <CameraOff className="size-12 text-muted-foreground" aria-hidden />
        <p className="text-lg font-medium">Câmera indisponível</p>
        <p className="text-base text-muted-foreground">{mensagem}</p>
        <div className="flex w-full flex-col gap-2">
          <Button className="h-12 w-full text-base" onClick={onUsarLista}>
            Usar a lista de inscritos
          </Button>
          {contextoSeguro && (
            <Button
              variant="outline"
              className="h-12 w-full text-base"
              onClick={() => {
                setErro(null);
                setTentativa((n) => n + 1);
              }}
            >
              Tentar de novo
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full overflow-hidden rounded-xl bg-black">
        <div className="aspect-square w-full">
          <Scanner
            key={tentativa}
            formats={["qr_code"]}
            constraints={{ facingMode: "environment" }}
            paused={registro.resultado !== null || registro.enviando}
            allowMultiple
            scanDelay={300}
            onScan={(codigos) => {
              const bruto = codigos[0]?.rawValue;
              if (bruto) registro.aoLerQr(bruto);
            }}
            onError={(e) => setErro(mensagemDoErroDeCamera(e))}
            classNames={{ container: "h-full w-full" }}
          />
        </div>
        <PainelResultado
          sobreposto
          resultado={registro.resultado}
          enviando={registro.enviando}
          onContinuar={registro.limpar}
          onIncluir={registro.incluirEregistrar}
        />
      </div>
      <p className="text-center text-base text-muted-foreground">
        Aponte a câmera para o QR code do participante.
      </p>
    </div>
  );
}
