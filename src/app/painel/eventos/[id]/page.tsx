import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ScanLine } from "lucide-react";
import { exigirOrganizador } from "@/lib/auth";
import { formatarPeriodo } from "@/lib/datas";
import { buscarInscritos, buscarTrabalhos } from "@/lib/painel/dados";
import { type TrabalhoPainel } from "@/lib/painel/trabalhos";
import { idSchema } from "@/lib/painel/schemas";
import { createClient } from "@/lib/supabase/server";
import { ROTULO_STATUS_EVENTO, type StatusEvento, type StatusTrabalho } from "@/lib/tipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MensagemErro } from "@/components/painel/campo";
import { AcoesStatus, CartaoInscricoes, ExcluirEventoBotao } from "@/components/painel/acoes-evento";
import { ConfigTrabalhos } from "@/components/painel/config-trabalhos";
import { ListaTrabalhos } from "@/components/painel/lista-trabalhos";
import { FormEvento } from "@/components/painel/form-evento";
import { ListaAtividades, type ContagemAtividade } from "@/components/painel/lista-atividades";
import { TabelaInscritos } from "@/components/painel/tabela-inscritos";

export async function generateMetadata({ params }: PageProps<"/painel/eventos/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return { title: "Evento" };
  const supabase = await createClient();
  const { data } = await supabase.from("eventos").select("titulo").eq("id", id).maybeSingle();
  return { title: data?.titulo ?? "Evento" };
}

const ABAS = ["geral", "atividades", "inscritos", "trabalhos"] as const;

export default async function PaginaEvento({
  params,
  searchParams,
}: PageProps<"/painel/eventos/[id]">) {
  await exigirOrganizador();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const { aba } = await searchParams;
  const abaInicial = ABAS.find((a) => a === aba) ?? "geral";

  const supabase = await createClient();
  const { data: evento } = await supabase.from("eventos").select("*").eq("id", id).maybeSingle();
  if (!evento) notFound();

  const [{ data: atividadesDb, error: erroAtividades }, inscritosRes, vagasRes, trabalhosRes] = await Promise.all([
    supabase.from("atividades").select("*").eq("evento_id", id).order("inicio", { ascending: true }),
    buscarInscritos(supabase, id),
    supabase.rpc("vagas_por_atividade", { p_evento_id: id }),
    buscarTrabalhos(supabase, id),
  ]);
  const atividades = atividadesDb ?? [];
  const inscritos = inscritosRes.dados;

  // Inscritos e presentes por atividade, a partir das inscrições confirmadas.
  const contagens: Record<string, ContagemAtividade> = {};
  for (const i of inscritos) {
    for (const a of i.atividades) {
      const c = (contagens[a.atividade_id] ??= { inscritos: 0, presentes: 0, fila: 0 });
      c.inscritos += 1;
      if (a.presente_em) c.presentes += 1;
    }
  }

  // Lista de espera: vem do banco (não aparece em inscritos nem na exportação).
  for (const v of vagasRes.data ?? []) {
    if (v.fila > 0) (contagens[v.atividade_id] ??= { inscritos: 0, presentes: 0, fila: 0 }).fila = v.fila;
  }

  for (const t of trabalhosRes.dados) {
    if (t.atividade_id) {
      (contagens[t.atividade_id] ??= { inscritos: 0, presentes: 0, fila: 0 }).trabalhos =
        (contagens[t.atividade_id]?.trabalhos ?? 0) + 1;
    }
  }

  const trabalhos: TrabalhoPainel[] = trabalhosRes.dados.map((t) => {
    const autor = Array.isArray(t.perfis) ? t.perfis[0] : t.perfis;
    return {
      id: t.id,
      titulo: t.titulo,
      area: t.area,
      modalidade: t.modalidade,
      temArquivo: !!t.arquivo_path,
      status: t.status as StatusTrabalho,
      parecer: t.parecer,
      atividade_id: t.atividade_id,
      ordem_apresentacao: t.ordem_apresentacao,
      autor: autor?.nome_completo ?? "(sem nome)",
      autor_email: autor?.email ?? "",
    };
  });
  const sessoes = atividades
    .filter((a) => a.tipo === "apresentacao")
    .map((a) => ({ id: a.id, titulo: a.titulo, inicio: a.inicio }));

  const status = evento.status as StatusEvento;
  const erroCarga = !!erroAtividades || !!inscritosRes.erro || !!vagasRes.error || !!trabalhosRes.erro;

  return (
    <div className="space-y-6">
      <Link href="/painel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Voltar para meus eventos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{evento.titulo}</h1>
            <Badge variant={status === "publicado" ? "default" : "secondary"}>
              {ROTULO_STATUS_EVENTO[status] ?? evento.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">{formatarPeriodo(evento.data_inicio, evento.data_fim)}</p>
          {status === "rascunho" ? (
            <p className="text-sm text-muted-foreground">
              Página pública disponível depois de publicar o evento.
            </p>
          ) : (
            <Link
              href={`/eventos/${evento.slug}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver página pública
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
        <Button
          className="h-12 px-6 text-base"
          render={<Link href={`/painel/eventos/${id}/presenca`} />}
          nativeButton={false}
        >
          <ScanLine aria-hidden />
          Registrar presença
        </Button>
      </div>

      {erroCarga && <MensagemErro erro="Parte dos dados não carregou. Atualize a página." />}

      <Tabs defaultValue={abaInicial}>
        <TabsList className="h-auto w-full sm:w-fit">
          <TabsTrigger value="geral" className="h-9 px-4">
            Visão geral
          </TabsTrigger>
          <TabsTrigger value="atividades" className="h-9 px-4">
            Atividades ({atividades.length})
          </TabsTrigger>
          <TabsTrigger value="inscritos" className="h-9 px-4">
            Inscritos ({inscritos.length})
          </TabsTrigger>
          <TabsTrigger value="trabalhos" className="h-9 px-4">
            Trabalhos ({trabalhos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Publicação</CardTitle>
              <CardDescription>Controle se o evento aparece no site.</CardDescription>
            </CardHeader>
            <CardContent>
              <AcoesStatus evento={{ id, status }} totalAtividades={atividades.length} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inscrições</CardTitle>
            </CardHeader>
            <CardContent>
              <CartaoInscricoes evento={evento} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dados do evento</CardTitle>
            </CardHeader>
            <CardContent>
              <FormEvento evento={evento} />
            </CardContent>
          </Card>

          {status === "rascunho" && (
            <Card>
              <CardHeader>
                <CardTitle>Excluir evento</CardTitle>
                <CardDescription>
                  Só rascunhos podem ser excluídos. Eventos publicados devem ser encerrados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExcluirEventoBotao id={id} titulo={evento.titulo} inscritos={inscritos.length} trabalhos={trabalhos.length} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="atividades" className="pt-4">
          <ListaAtividades
            eventoId={id}
            dataPadrao={evento.data_inicio}
            dataFim={evento.data_fim}
            atividades={atividades}
            contagens={contagens}
          />
        </TabsContent>

        <TabsContent value="inscritos" className="space-y-4 pt-4">
          {inscritos.length === 0 ? (
            <Card>
              <CardContent className="space-y-2 py-8 text-center">
                <p className="font-medium">Ainda não há inscritos</p>
                <p className="text-muted-foreground">
                  Quando as pessoas se inscreverem pelo site, elas aparecem aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            <TabelaInscritos
              eventoId={id}
              inscritos={inscritos.map(({ telefone, ...resto }) => {
                void telefone; // o telefone só vai para a planilha, não para a tela
                return resto;
              })}
              atividades={atividades.map((a) => ({ id: a.id, titulo: a.titulo }))}
            />
          )}
        </TabsContent>

        <TabsContent value="trabalhos" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recebimento de trabalhos</CardTitle>
              <CardDescription>Resumos e artigos enviados pelos participantes para avaliação.</CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigTrabalhos evento={evento} />
            </CardContent>
          </Card>
          <ListaTrabalhos trabalhos={trabalhos} sessoes={sessoes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
