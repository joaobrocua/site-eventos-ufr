import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CalendarDays, CheckCircle2, Info, MapPin, QrCode } from "lucide-react";
import { obterPerfil, obterUsuario } from "@/lib/auth";
import { formatarData, formatarPeriodo } from "@/lib/datas";
import { MENSAGEM_SITUACAO, situacaoInscricoes } from "@/lib/inscricao/regras";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import type { AtividadePublica } from "@/components/publico/atividade-info";
import { Programacao } from "@/components/publico/programacao";

const SLUG_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// cache(): generateMetadata e a página compartilham a mesma consulta.
const buscarEvento = cache(async (slug: string) => {
  if (!SLUG_VALIDO.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("eventos").select("*").eq("slug", slug).maybeSingle();
  return data;
});

export async function generateMetadata({ params }: PageProps<"/eventos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const evento = await buscarEvento(slug);
  if (!evento) return { title: "Evento não encontrado" };
  return { title: evento.titulo, description: evento.resumo ?? undefined };
}

export default async function PaginaEvento({ params }: PageProps<"/eventos/[slug]">) {
  const { slug } = await params;
  const evento = await buscarEvento(slug);
  if (!evento) notFound();

  const supabase = await createClient();
  const [usuario, perfil, ativRes, vagasRes] = await Promise.all([
    obterUsuario(),
    obterPerfil(),
    supabase.from("atividades").select("*").eq("evento_id", evento.id).order("inicio"),
    supabase.rpc("vagas_por_atividade", { p_evento_id: evento.id }),
  ]);

  const inscricaoRes =
    usuario && perfil
      ? await supabase
          .from("inscricoes")
          .select("id, inscricoes_atividades(atividade_id, status, presente_em)")
          .eq("evento_id", evento.id)
          .eq("usuario_id", usuario.id)
          .eq("status", "confirmada")
          .maybeSingle()
      : null;

  const vagasPorId = new Map((vagasRes.data ?? []).map((v) => [v.atividade_id, v]));
  const atividades: AtividadePublica[] = (ativRes.data ?? []).map((a) => ({
    id: a.id,
    titulo: a.titulo,
    descricao: a.descricao,
    tipo: a.tipo,
    palestrantes: a.palestrantes,
    local: a.local,
    inicio: a.inicio,
    fim: a.fim,
    carga_horaria_minutos: a.carga_horaria_minutos,
    vagas: vagasPorId.get(a.id),
  }));

  const situacao = situacaoInscricoes(evento);
  const inscricao = inscricaoRes?.data ?? null;
  const ativasInscricao = (inscricao?.inscricoes_atividades ?? []).filter((x) => x.status === "confirmada");
  const inscritas = ativasInscricao.map((x) => x.atividade_id);
  const presentes = ativasInscricao.filter((x) => x.presente_em).map((x) => x.atividade_id);
  const inscrito = !!inscricao;
  const caminho = `/eventos/${evento.slug}`;
  const proximo = encodeURIComponent(caminho);
  const logadoSemPerfil = !!usuario && !perfil;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:py-12">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{evento.titulo}</h1>
        <ul className="space-y-1.5 text-muted-foreground">
          <li className="flex items-center gap-2">
            <CalendarDays className="size-5 shrink-0" aria-hidden />
            <span>{formatarPeriodo(evento.data_inicio, evento.data_fim)}</span>
          </li>
          {evento.local && (
            <li className="flex items-center gap-2">
              <MapPin className="size-5 shrink-0" aria-hidden />
              <span>{evento.local}</span>
            </li>
          )}
        </ul>
        {evento.resumo && <p className="text-lg">{evento.resumo}</p>}
        {evento.descricao && <p className="whitespace-pre-line">{evento.descricao}</p>}
      </header>

      <section aria-label="Sua inscrição" className="space-y-3">
        {inscrito && (
          <div className="flex flex-col gap-3 rounded-xl border border-success/40 bg-success/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-lg font-semibold text-success">
              <CheckCircle2 className="size-5 shrink-0" aria-hidden />
              Você está inscrito
            </p>
            <Button
              className="h-11 text-base"
              variant="outline"
              render={<Link href="/minha-area" />}
              nativeButton={false}
            >
              <QrCode aria-hidden />
              Ver meu QR code
            </Button>
          </div>
        )}

        {!inscrito && !situacao.abertas && (
          <p role="status" className="flex items-start gap-2 rounded-xl border bg-muted p-4">
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              {MENSAGEM_SITUACAO[situacao.motivo]}
              {situacao.motivo === "prazo_encerrado" && evento.inscricoes_ate
                ? ` (até ${formatarData(evento.inscricoes_ate)}).`
                : ""}
            </span>
          </p>
        )}

        {!inscrito && situacao.abertas && !usuario && (
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <p>Para se inscrever, entre com o seu e-mail. Leva menos de um minuto.</p>
            <Button className="h-11 text-base" render={<Link href={`/entrar?proximo=${proximo}`} />} nativeButton={false}>
              Entrar para se inscrever
            </Button>
          </div>
        )}

        {!inscrito && situacao.abertas && logadoSemPerfil && (
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <p>Falta pouco: complete seu cadastro para escolher as atividades.</p>
            <Button className="h-11 text-base" render={<Link href={`/cadastro?proximo=${proximo}`} />} nativeButton={false}>
              Completar cadastro
            </Button>
          </div>
        )}

        {!inscrito && situacao.abertas && usuario && perfil && (
          <p className="rounded-xl border bg-card p-4">
            Marque as atividades que você quer assistir e confirme a inscrição no fim da página.
          </p>
        )}

        {inscrito && !situacao.abertas && (
          <p role="status" className="text-sm text-muted-foreground">
            {MENSAGEM_SITUACAO[situacao.motivo]} Não é possível incluir novas atividades.
          </p>
        )}
      </section>

      <section aria-labelledby="titulo-programacao" className="space-y-4">
        <h2 id="titulo-programacao" className="text-2xl font-semibold">
          Programação
        </h2>
        {atividades.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            A programação ainda não foi divulgada. Volte em breve.
          </p>
        ) : (
          <Programacao
            eventoId={evento.id}
            slug={evento.slug}
            atividades={atividades}
            podeEscolher={!!usuario && !!perfil && situacao.abertas}
            podeAlterar={evento.status === "publicado"}
            inscrito={inscrito}
            inscritas={inscritas}
            presentes={presentes}
          />
        )}
      </section>
    </div>
  );
}
