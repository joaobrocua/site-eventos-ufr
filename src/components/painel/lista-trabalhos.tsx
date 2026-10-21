"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { formatarData } from "@/lib/datas";
import { contarPorStatus, filtrarTrabalhos, type DetalheTrabalhoDados, type TrabalhoPainel } from "@/lib/painel/trabalhos";
import {
  ROTULO_MODALIDADE,
  ROTULO_STATUS_TRABALHO,
  type ModalidadeTrabalho,
  type StatusTrabalho,
} from "@/lib/tipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { decidirTrabalho, detalheTrabalho, urlPdfTrabalho, vincularSessao } from "@/app/painel/eventos/trabalhos-actions";
import { Campo, MensagemErro } from "./campo";
import { chamar } from "./chamar";

export type SessaoApresentacao = { id: string; titulo: string; inicio: string };

const TODOS = "todos";
const NENHUMA = "nenhuma";
const STATUS: StatusTrabalho[] = ["submetido", "aprovado", "reprovado", "retirado"];

function BadgeStatus({ status }: { status: StatusTrabalho }) {
  return (
    <Badge variant={status === "aprovado" ? "default" : status === "reprovado" ? "destructive" : "secondary"}>
      {ROTULO_STATUS_TRABALHO[status]}
    </Badge>
  );
}

export function ListaTrabalhos({
  trabalhos,
  sessoes,
}: {
  trabalhos: TrabalhoPainel[];
  sessoes: SessaoApresentacao[];
}) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<string>(TODOS);
  const [area, setArea] = useState<string>(TODOS);
  const [aberto, setAberto] = useState<string | null>(null);

  const contagem = useMemo(() => contarPorStatus(trabalhos), [trabalhos]);
  const areas = useMemo(
    () => [...new Set(trabalhos.map((t) => t.area).filter((a): a is string => !!a))].sort(),
    [trabalhos],
  );
  const itensStatus = [
    { value: TODOS, label: "Todas as situações" },
    ...STATUS.map((s) => ({ value: s, label: ROTULO_STATUS_TRABALHO[s] })),
  ];
  const itensArea = [{ value: TODOS, label: "Todas as áreas" }, ...areas.map((a) => ({ value: a, label: a }))];
  const nomeSessao = (id: string | null) => sessoes.find((s) => s.id === id)?.titulo ?? null;

  const filtrados = filtrarTrabalhos(
    trabalhos,
    busca,
    status === TODOS ? null : (status as StatusTrabalho),
    area === TODOS ? null : area,
  );
  const selecionado = trabalhos.find((t) => t.id === aberto) ?? null;

  if (trabalhos.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-2 py-8 text-center">
          <p className="font-medium">Nenhum trabalho enviado ainda</p>
          <p className="text-muted-foreground">
            Ligue &quot;Receber trabalhos&quot; acima para que os participantes possam enviar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2 text-sm">
        {STATUS.map((s) => (
          <li key={s} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5">
            <span className="text-muted-foreground">{ROTULO_STATUS_TRABALHO[s]}:</span>
            <span className="font-medium">{contagem[s]}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-2">
          <Label htmlFor="busca-trabalhos">Buscar por título, autor ou e-mail</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="busca-trabalhos" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className="h-11 pl-9 text-base" />
          </div>
        </div>
        <div className="w-full space-y-2 sm:w-56">
          <Label htmlFor="filtro-status">Situação</Label>
          <Select items={itensStatus} value={status} onValueChange={(v) => v && setStatus(v)}>
            <SelectTrigger id="filtro-status" className="h-11 w-full text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itensStatus.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full space-y-2 sm:w-56">
          <Label htmlFor="filtro-area">Área</Label>
          <Select items={itensArea} value={area} onValueChange={(v) => v && setArea(v)}>
            <SelectTrigger id="filtro-area" className="h-11 w-full text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itensArea.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtrados.length} de {trabalhos.length} trabalhos
      </p>

      {filtrados.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum trabalho encontrado com esse filtro.
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Sessão</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((t) => (
                <TableRow key={t.id} className={t.status === "retirado" ? "opacity-60" : undefined}>
                  <TableCell className="font-medium whitespace-normal">{t.titulo}</TableCell>
                  <TableCell className="whitespace-normal">{t.autor}</TableCell>
                  <TableCell className="whitespace-normal">{t.area ?? "—"}</TableCell>
                  <TableCell>{ROTULO_MODALIDADE[t.modalidade as ModalidadeTrabalho] ?? t.modalidade}</TableCell>
                  <TableCell>
                    <BadgeStatus status={t.status} />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {nomeSessao(t.atividade_id) ?? "—"}
                    {t.ordem_apresentacao ? ` (nº ${t.ordem_apresentacao})` : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setAberto(t.id)}>
                      {t.status === "retirado" ? "Ver" : "Avaliar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!selecionado} onOpenChange={(v) => !v && setAberto(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          {selecionado && (
            <DetalheTrabalho key={selecionado.id} trabalho={selecionado} sessoes={sessoes} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetalheTrabalho({
  trabalho: t,
  sessoes,
}: {
  trabalho: TrabalhoPainel;
  sessoes: SessaoApresentacao[];
}) {
  const router = useRouter();
  const retirado = t.status === "retirado";
  const [parecer, setParecer] = useState(t.parecer ?? "");
  const [sessao, setSessao] = useState(t.atividade_id ?? NENHUMA);
  const [ordem, setOrdem] = useState(t.ordem_apresentacao ? String(t.ordem_apresentacao) : "");
  const [erro, setErro] = useState<string | null>(null);
  const [erroSessao, setErroSessao] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [abrindoPdf, setAbrindoPdf] = useState(false);
  // Resumo, palavras-chave e coautores só são buscados ao abrir o detalhe.
  const [dados, setDados] = useState<DetalheTrabalhoDados | null>(null);
  const [erroDados, setErroDados] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    chamar(() => detalheTrabalho(t.id)).then((r) => {
      if (!ativo) return;
      if (r.ok) setDados(r.dados);
      else setErroDados(r.erro);
    });
    return () => {
      ativo = false;
    };
  }, [t.id]);

  const itensSessao = [
    { value: NENHUMA, label: "Sem sessão" },
    ...sessoes.map((s) => ({ value: s.id, label: `${s.titulo} (${formatarData(s.inicio)})` })),
  ];

  function decidir(status: "aprovado" | "reprovado" | "submetido", sucesso: string) {
    setErro(null);
    iniciar(async () => {
      const r = await chamar(() => decidirTrabalho(t.id, { status, parecer }));
      if (!r.ok) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success(sucesso);
      router.refresh();
    });
  }

  function salvarSessao() {
    setErroSessao(null);
    iniciar(async () => {
      const r = await chamar(() =>
        vincularSessao(t.id, { atividade_id: sessao === NENHUMA ? null : sessao, ordem }),
      );
      if (!r.ok) {
        setErroSessao(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success("Sessão salva.");
      router.refresh();
    });
  }

  async function baixarPdf() {
    setAbrindoPdf(true);
    const r = await chamar(() => urlPdfTrabalho(t.id));
    setAbrindoPdf(false);
    if (!r.ok) {
      toast.error(r.erro);
      return;
    }
    // URL assinada de 60 s; se o navegador bloquear a nova aba, abre nesta mesma.
    if (!window.open(r.dados.url, "_blank")) window.location.href = r.dados.url;
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.titulo}</DialogTitle>
        <DialogDescription>
          {t.autor} ({t.autor_email}) · {ROTULO_STATUS_TRABALHO[t.status]}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 text-sm">
        <dl className="space-y-3">
          <div>
            <dt className="font-medium">Resumo</dt>
            <dd className="whitespace-pre-line text-muted-foreground">
              {dados ? dados.resumo : erroDados ? <span role="alert" className="text-destructive">{erroDados}</span> : "Carregando..."}
            </dd>
          </div>
          {dados?.palavras_chave && (
            <div>
              <dt className="font-medium">Palavras-chave</dt>
              <dd className="text-muted-foreground">{dados.palavras_chave}</dd>
            </div>
          )}
          <div>
            <dt className="font-medium">Coautores</dt>
            <dd className="text-muted-foreground">{!dados ? "..." : dados.coautores.length ? dados.coautores.join(", ") : "Nenhum"}</dd>
          </div>
          <div>
            <dt className="font-medium">Área e modalidade</dt>
            <dd className="text-muted-foreground">
              {t.area ?? "Sem área"} · {ROTULO_MODALIDADE[t.modalidade as ModalidadeTrabalho] ?? t.modalidade}
            </dd>
          </div>
        </dl>

        {t.temArquivo ? (
          <Button variant="outline" className="h-11" onClick={baixarPdf} disabled={abrindoPdf}>
            {abrindoPdf ? <Loader2 className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
            Baixar PDF
          </Button>
        ) : (
          <p className="text-muted-foreground">PDF ainda não enviado.</p>
        )}

        {!retirado && (
          <>
            <Campo
              id="parecer"
              rotulo="Comentário para o autor"
              ajuda="Opcional. Vai junto do e-mail com a decisão (até 3000 letras)."
            >
              <Textarea
                id="parecer"
                rows={4}
                maxLength={3000}
                value={parecer}
                onChange={(e) => setParecer(e.target.value)}
                className="text-base"
              />
            </Campo>
            <MensagemErro erro={erro} />
            {!t.temArquivo && (
              <p className="text-sm text-muted-foreground">O autor ainda não enviou o PDF; por isso não dá para aprovar.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-11"
                disabled={pendente || !t.temArquivo}
                onClick={() => decidir("aprovado", "Trabalho aprovado. O autor será avisado por e-mail.")}
              >
                Aprovar
              </Button>
              <Button
                variant="destructive"
                className="h-11"
                disabled={pendente}
                onClick={() => decidir("reprovado", "Decisão registrada. O autor será avisado por e-mail.")}
              >
                Não aprovar
              </Button>
              {t.status !== "submetido" && (
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={pendente}
                  onClick={() => decidir("submetido", "O trabalho voltou para análise.")}
                >
                  Voltar para análise
                </Button>
              )}
            </div>

            {t.status === "aprovado" && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="font-medium">Sessão de apresentação</p>
                {sessoes.length === 0 ? (
                  <p className="text-muted-foreground">
                    Este evento ainda não tem sessão de apresentação. Na aba Atividades, adicione uma atividade do
                    tipo &quot;Apresentação&quot; e volte aqui para encaixar o trabalho.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="sessao">Sessão</Label>
                      <Select items={itensSessao} value={sessao} onValueChange={(v) => v && setSessao(v)}>
                        <SelectTrigger id="sessao" className="h-11 w-full text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {itensSessao.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                              {i.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Campo id="ordem" rotulo="Ordem de apresentação" ajuda="Número da vez do trabalho na sessão (opcional).">
                      <Input
                        id="ordem"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={999}
                        value={ordem}
                        onChange={(e) => setOrdem(e.target.value)}
                        disabled={sessao === NENHUMA}
                        className="h-11 text-base"
                      />
                    </Campo>
                    <MensagemErro erro={erroSessao} />
                    <Button variant="outline" className="h-11" disabled={pendente} onClick={salvarSessao}>
                      {pendente && <Loader2 className="animate-spin" aria-hidden />}
                      Salvar sessão
                    </Button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
