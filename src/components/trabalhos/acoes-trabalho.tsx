"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { caminhoDoPdf, retirarTrabalho, urlDoMeuPdf } from "@/app/minha-area/trabalhos/actions";
import { validarConteudoPdf, validarPdf } from "@/lib/trabalhos/arquivo";
import type { AcoesTrabalho } from "@/lib/trabalhos/permissoes";
import { apagarPdf, reenviarPdf } from "./enviar-pdf";

type Props = { trabalhoId: string; titulo: string; acoes: AcoesTrabalho };

export function AcoesDoTrabalho({ trabalhoId, titulo, acoes }: Props) {
  const router = useRouter();
  const inputPdf = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState<"baixar" | "reenviar" | "retirar" | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  async function baixar() {
    setOcupado("baixar");
    const r = await urlDoMeuPdf(trabalhoId);
    setOcupado(null);
    if (!r.ok) return toast.error(r.erro);
    window.location.assign(r.dados.url);
  }

  async function aoEscolherPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const erro = validarPdf(f) ?? (await validarConteudoPdf(f));
    if (erro) return toast.error(erro);

    setOcupado("reenviar");
    const falha = await reenviarPdf(trabalhoId, f);
    setOcupado(null);
    if (falha) return toast.error(falha);
    toast.success("PDF enviado.");
    router.refresh();
  }

  async function retirar() {
    setOcupado("retirar");
    // O caminho do PDF é pego antes de retirar; o arquivo só pode ser apagado depois.
    const c = await caminhoDoPdf(trabalhoId);
    const r = await retirarTrabalho(trabalhoId);
    if (!r.ok) {
      setOcupado(null);
      toast.error(r.erro);
      return;
    }
    if (c.ok) await apagarPdf(c.dados.caminho);
    setOcupado(null);
    setConfirmando(false);
    toast.success("Trabalho retirado.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {acoes.reenviarPdf && (
        <>
          <input
            ref={inputPdf}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={aoEscolherPdf}
          />
          <Button
            className="h-11 text-base"
            disabled={ocupado !== null}
            onClick={() => inputPdf.current?.click()}
          >
            <Upload aria-hidden /> {ocupado === "reenviar" ? "Enviando PDF…" : "Enviar o PDF"}
          </Button>
        </>
      )}
      {acoes.editar && (
        <Button
          variant="outline"
          className="h-11 text-base"
          render={<Link href={`/minha-area/trabalhos/${trabalhoId}/editar`} />}
          nativeButton={false}
        >
          <Pencil aria-hidden /> Editar
        </Button>
      )}
      {acoes.baixarPdf && (
        <Button variant="outline" className="h-11 text-base" disabled={ocupado !== null} onClick={baixar}>
          <Download aria-hidden /> {ocupado === "baixar" ? "Abrindo…" : "Baixar meu PDF"}
        </Button>
      )}
      {acoes.retirar && (
        <>
          <Button
            variant="destructive"
            className="h-11 text-base"
            disabled={ocupado !== null}
            onClick={() => setConfirmando(true)}
          >
            <Trash2 aria-hidden /> Retirar trabalho
          </Button>
          <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Retirar este trabalho?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{titulo}&rdquo; deixará de participar do evento e o PDF enviado também será apagado. Não dá para desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={ocupado === "retirar"}>Manter trabalho</AlertDialogCancel>
                <Button variant="destructive" disabled={ocupado === "retirar"} onClick={retirar}>
                  {ocupado === "retirar" ? "Retirando…" : "Retirar"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
