"use client";

import { useMemo, useState } from "react";
import { Check, Download, Loader2, Search } from "lucide-react";
import { filtrarInscritos, type InscritoPainel } from "@/lib/painel/inscritos";
import { baixarArquivo } from "./chamar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TODAS = "todas";

export function TabelaInscritos({
  eventoId,
  inscritos,
  atividades,
}: {
  eventoId: string;
  inscritos: InscritoPainel[];
  atividades: { id: string; titulo: string }[];
}) {
  const [busca, setBusca] = useState("");
  const [atividadeId, setAtividadeId] = useState<string>(TODAS);

  const titulos = useMemo(() => Object.fromEntries(atividades.map((a) => [a.id, a.titulo])), [atividades]);
  const itens = useMemo(
    () => [{ value: TODAS, label: "Todas as atividades" }, ...atividades.map((a) => ({ value: a.id, label: a.titulo }))],
    [atividades],
  );
  const filtrados = useMemo(
    () => filtrarInscritos(inscritos, busca, atividadeId === TODAS ? null : atividadeId),
    [inscritos, busca, atividadeId],
  );

  const [baixando, setBaixando] = useState(false);
  async function baixar() {
    setBaixando(true);
    await baixarArquivo(exportarHref, "inscritos.csv");
    setBaixando(false);
  }

  const exportarHref =
    `/painel/eventos/${eventoId}/exportar` + (atividadeId === TODAS ? "" : `?atividade=${atividadeId}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-2">
          <Label htmlFor="busca-inscritos">Buscar por nome, RGA ou e-mail</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="busca-inscritos"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-11 pl-9 text-base"
            />
          </div>
        </div>
        <div className="w-full space-y-2 sm:w-72">
          <Label htmlFor="filtro-atividade">Atividade</Label>
          <Select items={itens} value={atividadeId} onValueChange={(v) => v && setAtividadeId(v)}>
            <SelectTrigger id="filtro-atividade" className="h-11 w-full text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itens.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          className="h-11 px-5 text-base"
          onClick={baixar}
          disabled={baixando}
        >
          {baixando ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
          {atividadeId === TODAS ? "Baixar lista (Excel)" : "Lista de presença (Excel)"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtrados.length === inscritos.length
          ? `${inscritos.length} ${inscritos.length === 1 ? "inscrito" : "inscritos"}`
          : `${filtrados.length} de ${inscritos.length} inscritos`}
      </p>

      {filtrados.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {inscritos.length === 0
              ? "Ainda não há inscritos neste evento."
              : "Nenhum inscrito encontrado com esse filtro."}
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>RGA</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Atividades</TableHead>
                <TableHead className="text-right">Presenças</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((i) => {
                const presencas = i.atividades.filter((a) => a.presente_em).length;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium whitespace-normal">{i.nome}</TableCell>
                    <TableCell className="whitespace-normal">{i.email}</TableCell>
                    <TableCell>{i.rga ?? "—"}</TableCell>
                    <TableCell className="whitespace-normal">{i.curso ?? "—"}</TableCell>
                    <TableCell className="whitespace-normal">
                      {i.atividades.length === 0 ? (
                        <span className="text-muted-foreground">Nenhuma</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {i.atividades.map((a) => (
                            <li key={a.atividade_id} className="flex items-center gap-1">
                              {a.presente_em && <Check className="size-3.5 shrink-0 text-success" aria-label="Presente" />}
                              <span>{titulos[a.atividade_id] ?? "Atividade removida"}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {presencas} de {i.atividades.length}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
