"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Evento } from "@/lib/tipos";
import { gerarSlug } from "@/lib/painel/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { atualizarEvento, criarEvento } from "@/app/painel/eventos/actions";
import { Campo, MensagemErro } from "./campo";
import { chamar } from "./chamar";

export function FormEvento({ evento }: { evento?: Evento }) {
  const router = useRouter();
  const editando = !!evento;
  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [slug, setSlug] = useState(evento?.slug ?? "");
  // Enquanto a pessoa não mexe no endereço, ele acompanha o título.
  const [slugManual, setSlugManual] = useState(editando);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // onSubmit (e não action=) para o React não limpar os campos se der erro.
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const entrada = Object.fromEntries(new FormData(e.currentTarget));
    iniciar(async () => {
      if (evento) {
        const r = await chamar(() => atualizarEvento(evento.id, entrada));
        if (!r.ok) {
          setErro(r.erro);
          toast.error(r.erro);
          return;
        }
        toast.success("Dados do evento salvos.");
        router.refresh();
        return;
      }
      const r = await chamar(() => criarEvento(entrada));
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      toast.success("Evento criado como rascunho. Agora cadastre as atividades.");
      router.push(`/painel/eventos/${r.dados.id}?aba=atividades`);
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      <Campo id="titulo" rotulo="Título do evento *">
        <Input
          id="titulo"
          name="titulo"
          required
          maxLength={150}
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            if (!slugManual) setSlug(gerarSlug(e.target.value));
          }}
          placeholder="Ex.: Semana de Engenharia de Minas 2026"
          className="h-11 text-base"
        />
      </Campo>

      <Campo
        id="slug"
        rotulo="Endereço da página *"
        ajuda={
          <>
            A página pública ficará em <strong>/eventos/{slug || "endereço"}</strong>. É criado
            sozinho a partir do título.
            {editando && " Se mudar com o evento já divulgado, os links antigos deixam de funcionar."}
          </>
        }
      >
        <Input
          id="slug"
          name="slug"
          required
          maxLength={80}
          value={slug}
          aria-describedby="slug-ajuda"
          onChange={(e) => {
            setSlugManual(true);
            setSlug(e.target.value.toLowerCase());
          }}
          className="h-11 text-base"
        />
      </Campo>

      <Campo id="resumo" rotulo="Resumo" ajuda="Uma ou duas frases que aparecem na lista de eventos (até 300 letras).">
        <Textarea
          id="resumo"
          name="resumo"
          maxLength={300}
          rows={2}
          defaultValue={evento?.resumo ?? ""}
          className="text-base"
        />
      </Campo>

      <Campo id="descricao" rotulo="Descrição completa" ajuda="Conte tudo sobre o evento: objetivo, público, como participar.">
        <Textarea
          id="descricao"
          name="descricao"
          maxLength={10000}
          rows={6}
          defaultValue={evento?.descricao ?? ""}
          className="text-base"
        />
      </Campo>

      <Campo id="local" rotulo="Local" ajuda="Ex.: Auditório do Bloco A, campus UFR Rondonópolis.">
        <Input
          id="local"
          name="local"
          maxLength={200}
          defaultValue={evento?.local ?? ""}
          className="h-11 text-base"
        />
      </Campo>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="data_inicio" rotulo="Primeiro dia *">
          <Input
            id="data_inicio"
            name="data_inicio"
            type="date"
            required
            defaultValue={evento?.data_inicio ?? ""}
            className="h-11 text-base"
          />
        </Campo>
        <Campo id="data_fim" rotulo="Último dia *" ajuda="Se o evento dura um dia só, repita a mesma data.">
          <Input
            id="data_fim"
            name="data_fim"
            type="date"
            required
            defaultValue={evento?.data_fim ?? ""}
            className="h-11 text-base"
          />
        </Campo>
      </div>

      <Campo id="capa_url" rotulo="Link da imagem de capa (opcional)" ajuda="Endereço de uma imagem na internet, começando com https://.">
        <Input
          id="capa_url"
          name="capa_url"
          type="url"
          inputMode="url"
          placeholder="https://..."
          defaultValue={evento?.capa_url ?? ""}
          className="h-11 text-base"
        />
      </Campo>

      <MensagemErro erro={erro} />

      <Button type="submit" className="h-11 w-full text-base sm:w-auto sm:px-8" disabled={pendente}>
        {pendente && <Loader2 className="animate-spin" aria-hidden />}
        {editando ? "Salvar alterações" : "Criar evento"}
      </Button>
    </form>
  );
}
