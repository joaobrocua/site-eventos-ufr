"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { moverItem } from "@/lib/painel/certificados";
import type { Assinatura, Evento } from "@/lib/tipos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { salvarConfigCertificado } from "@/app/painel/eventos/certificados-actions";
import { Campo, MensagemErro } from "./campo";
import { chamar } from "./chamar";

const MAX_ASSINATURAS = 3;

/** Lê o jsonb do banco com segurança. */
function lerAssinaturas(valor: unknown): Assinatura[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((v): v is Assinatura => !!v && typeof v.nome === "string" && typeof v.cargo === "string")
    .map((v) => ({ nome: v.nome, cargo: v.cargo }));
}

export function ConfigCertificado({
  evento,
}: {
  evento: Pick<Evento, "id" | "titulo" | "certificado_promotor" | "certificado_texto" | "certificado_registro" | "certificado_assinaturas">;
}) {
  const router = useRouter();
  const [promotor, setPromotor] = useState(evento.certificado_promotor ?? "");
  const [texto, setTexto] = useState(evento.certificado_texto ?? "");
  const [registro, setRegistro] = useState(evento.certificado_registro ?? "");
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>(lerAssinaturas(evento.certificado_assinaturas));
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function mudar(idx: number, campo: keyof Assinatura, valor: string) {
    setAssinaturas(assinaturas.map((a, i) => (i === idx ? { ...a, [campo]: valor } : a)));
  }

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await chamar(() => salvarConfigCertificado(evento.id, { promotor, texto, registro, assinaturas }));
      if (!r.ok) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success("Configuração do certificado salva.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
        Título, local e datas do evento, texto complementar, registro e assinaturas são lidos na hora de gerar o PDF:
        alterá-los depois de liberar muda também os PDFs já emitidos. Nome, documento, atividades e carga horária ficam
        congelados no momento da emissão.
      </p>
      <Campo
        id="cert_promotor"
        rotulo="Promovido…"
        ajuda={<>Escreva como continua a frase &quot;…promovido ___&quot;. Ex.: &quot;pelo Curso de Engenharia de Minas&quot;, &quot;pela Coordenação de Extensão&quot;.</>}
      >
        <Input
          id="cert_promotor"
          maxLength={200}
          placeholder="pela Secretaria de Inovação e Empreendedorismo"
          value={promotor}
          onChange={(e) => setPromotor(e.target.value)}
          className="h-11 text-base"
        />
        {promotor.trim() && (
          <p className="rounded-md bg-muted p-2 text-xs" aria-live="polite">
            Prévia: …do evento {evento.titulo}, promovido {promotor.trim()}, realizado em…
          </p>
        )}
      </Campo>

      <Campo
        id="cert_texto"
        rotulo="Texto complementar (opcional)"
        ajuda="Aparece no certificado. Ex.: evento de extensão vinculado ao curso de Engenharia de Minas (até 1500 letras)."
      >
        <Textarea
          id="cert_texto"
          rows={4}
          maxLength={1500}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="text-base"
        />
      </Campo>

      <Campo
        id="cert_registro"
        rotulo="Número de registro da ação de extensão ou processo (opcional)"
        ajuda="Se o evento tem registro na pró-reitoria, informe aqui."
      >
        <Input
          id="cert_registro"
          maxLength={200}
          value={registro}
          onChange={(e) => setRegistro(e.target.value)}
          className="h-11 text-base"
        />
      </Campo>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Assinaturas</legend>
        <p className="text-xs text-muted-foreground">
          Até {MAX_ASSINATURAS}. Saem impressas no certificado com nome e cargo. Imagem da assinatura ainda não é
          suportada.
        </p>
        <ul className="space-y-3">
          {assinaturas.map((a, idx) => (
            <li key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <Input
                aria-label={`Nome da assinatura ${idx + 1}`}
                placeholder="Nome"
                value={a.nome}
                maxLength={120}
                onChange={(e) => mudar(idx, "nome", e.target.value)}
                className="h-11 min-w-40 flex-1 text-base"
              />
              <Input
                aria-label={`Cargo da assinatura ${idx + 1}`}
                placeholder="Cargo (ex.: Coordenadora do curso)"
                value={a.cargo}
                maxLength={120}
                onChange={(e) => mudar(idx, "cargo", e.target.value)}
                className="h-11 min-w-40 flex-1 text-base"
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Subir assinatura ${idx + 1}`}
                  disabled={idx === 0}
                  onClick={() => setAssinaturas(moverItem(assinaturas, idx, idx - 1))}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Descer assinatura ${idx + 1}`}
                  disabled={idx === assinaturas.length - 1}
                  onClick={() => setAssinaturas(moverItem(assinaturas, idx, idx + 1))}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Remover assinatura ${idx + 1}`}
                  onClick={() => setAssinaturas(assinaturas.filter((_, i) => i !== idx))}
                >
                  <X aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          disabled={assinaturas.length >= MAX_ASSINATURAS}
          onClick={() => setAssinaturas([...assinaturas, { nome: "", cargo: "" }])}
        >
          <Plus aria-hidden />
          Adicionar assinatura
        </Button>
      </fieldset>

      <MensagemErro erro={erro} />
      <Button className="h-11 px-6 text-base" onClick={salvar} disabled={pendente}>
        {pendente && <Loader2 className="animate-spin" aria-hidden />}
        Salvar certificado
      </Button>
    </div>
  );
}
