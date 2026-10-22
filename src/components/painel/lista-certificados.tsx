"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { formatarCargaHoraria } from "@/lib/datas";
import { filtrarCertificados, type CertificadoPainel } from "@/lib/painel/certificados";
import { ROTULO_TIPO_CERTIFICADO, type TipoCertificado } from "@/lib/tipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { revogarCertificado } from "@/app/painel/eventos/certificados-actions";
import { Campo, MensagemErro } from "./campo";
import { chamar } from "./chamar";

export function ListaCertificados({ certificados }: { certificados: CertificadoPainel[] }) {
  const [busca, setBusca] = useState("");
  const [revogando, setRevogando] = useState<CertificadoPainel | null>(null);
  const filtrados = filtrarCertificados(certificados, busca);

  if (certificados.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum certificado emitido ainda.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="busca-certificados">Buscar por nome ou código</Label>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="busca-certificados"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-11 pl-9 text-base"
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtrados.length} de {certificados.length} certificados
      </p>

      {filtrados.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum certificado encontrado.
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Carga</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((c) => (
                <TableRow key={c.id} className={c.revogado_em ? "opacity-70" : undefined}>
                  <TableCell className="font-medium whitespace-normal">{c.nome}</TableCell>
                  <TableCell className="whitespace-normal">
                    {ROTULO_TIPO_CERTIFICADO[c.tipo as TipoCertificado] ?? c.tipo}
                  </TableCell>
                  <TableCell>{formatarCargaHoraria(c.carga_horaria_minutos)}</TableCell>
                  <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                  <TableCell className="whitespace-normal">
                    {c.revogado_em ? (
                      <div className="space-y-0.5">
                        <Badge variant="destructive">Revogado</Badge>
                        {c.revogado_motivo && (
                          <p className="text-xs text-muted-foreground">{c.revogado_motivo}</p>
                        )}
                      </div>
                    ) : (
                      <Badge variant="secondary">Válido</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-normal">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<a href={`/certificados/${c.codigo}`} target="_blank" rel="noreferrer" />}
                        nativeButton={false}
                      >
                        Validação
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<a href={`/certificados/${c.codigo}/pdf`} target="_blank" rel="noreferrer" />}
                        nativeButton={false}
                      >
                        PDF
                      </Button>
                      {!c.revogado_em && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setRevogando(c)}
                        >
                          Revogar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!revogando} onOpenChange={(v) => !v && setRevogando(null)}>
        <DialogContent>
          {revogando && (
            <FormRevogar key={revogando.id} certificado={revogando} aoConcluir={() => setRevogando(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormRevogar({ certificado, aoConcluir }: { certificado: CertificadoPainel; aoConcluir: () => void }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await chamar(() => revogarCertificado(certificado.id, motivo));
      if (!r.ok) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success("Certificado revogado.");
      aoConcluir();
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Revogar certificado</DialogTitle>
        <DialogDescription>
          O certificado de {certificado.nome} passa a aparecer como revogado na validação pública.
        </DialogDescription>
      </DialogHeader>
      <Campo id="motivo" rotulo="Motivo *" ajuda="Visível só para a organização e para o titular. Uma revogação manual não é desfeita ao liberar de novo.">
        <Input
          id="motivo"
          required
          minLength={5}
          maxLength={300}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="h-11 text-base"
        />
      </Campo>
      <MensagemErro erro={erro} />
      <Button type="submit" variant="destructive" className="h-11 w-full text-base" disabled={pendente}>
        {pendente && <Loader2 className="animate-spin" aria-hidden />}
        Revogar certificado
      </Button>
    </form>
  );
}
