"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { editarTrabalho, submeterTrabalho } from "@/app/minha-area/trabalhos/actions";
import { ROTULO_MODALIDADE, type ModalidadeTrabalho } from "@/lib/tipos";
import { validarConteudoPdf, validarPdf } from "@/lib/trabalhos/arquivo";
import { MAX_COAUTORES } from "@/lib/trabalhos/coautores";
import { criarTrabalhoSchema, MODALIDADES } from "@/lib/trabalhos/schemas";
import { enviarEConfirmarPdf } from "./enviar-pdf";

type Valores = {
  titulo: string;
  resumo: string;
  palavrasChave: string;
  area: string;
  modalidade: ModalidadeTrabalho;
  coautores: string[];
};

type Props = {
  areas: string[];
  /** Evento onde o trabalho será criado (modo novo). */
  eventoId?: string;
  /** Trabalho existente (modo edição). */
  trabalhoId?: string;
  temPdf?: boolean;
  inicial?: Partial<Valores>;
};

const DESTINO = "/minha-area/trabalhos";

type Etapa = "dados" | "pdf" | null;

export function FormularioTrabalho({ areas, eventoId, trabalhoId, temPdf, inicial }: Props) {
  const router = useRouter();
  const edicao = Boolean(trabalhoId);
  const [v, setV] = useState<Valores>({
    titulo: inicial?.titulo ?? "",
    resumo: inicial?.resumo ?? "",
    palavrasChave: inicial?.palavrasChave ?? "",
    area: inicial?.area ?? "",
    modalidade: inicial?.modalidade ?? "oral",
    coautores: inicial?.coautores ?? [],
  });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [etapa, setEtapa] = useState<Etapa>(null);
  const enviando = etapa !== null;

  const opcoesModalidade = MODALIDADES.map((m) => ({ value: m, label: ROTULO_MODALIDADE[m] }));
  const opcoesArea = areas.map((a) => ({ value: a, label: a }));

  function alterar<K extends keyof Valores>(campo: K, valor: Valores[K]) {
    setV((atual) => ({ ...atual, [campo]: valor }));
  }

  function alterarCoautor(i: number, nome: string) {
    setV((atual) => ({ ...atual, coautores: atual.coautores.map((c, j) => (j === i ? nome : c)) }));
  }

  function escolherArquivo(f: File | null) {
    setArquivo(f);
    const erro = f ? validarPdf(f) : null;
    setErros((e) => {
      const resto = { ...e };
      delete resto.arquivo;
      return erro ? { ...resto, arquivo: erro } : resto;
    });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;

    const novosErros: Record<string, string> = {};
    const r = criarTrabalhoSchema(areas).safeParse(v);
    if (!r.success) {
      for (const issue of r.error.issues) {
        const chave = String(issue.path[0] ?? "geral");
        novosErros[chave] ??= issue.message;
      }
    }
    if (arquivo) {
      const erroPdf = validarPdf(arquivo) ?? (await validarConteudoPdf(arquivo));
      if (erroPdf) novosErros.arquivo = erroPdf;
    } else if (!edicao) {
      novosErros.arquivo = "Anexe o PDF do trabalho.";
    }
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0 || !r.success) {
      toast.error("Confira os campos destacados.");
      return;
    }

    setEtapa("dados");
    let idTrabalho = trabalhoId;
    let caminho: string;
    if (edicao && trabalhoId) {
      const res = await editarTrabalho(trabalhoId, v);
      if (!res.ok) {
        setEtapa(null);
        toast.error(res.erro);
        return;
      }
      caminho = res.dados.caminho;
    } else {
      const res = await submeterTrabalho(eventoId!, v);
      if (!res.ok) {
        setEtapa(null);
        toast.error(res.erro);
        return;
      }
      idTrabalho = res.dados.trabalhoId;
      caminho = res.dados.caminho;
    }

    if (arquivo && idTrabalho) {
      setEtapa("pdf");
      const erroPdf = await enviarEConfirmarPdf(idTrabalho, caminho, arquivo);
      if (erroPdf) {
        // Os dados já foram salvos: a pessoa reenvia o PDF pela lista de trabalhos.
        toast.warning(
          edicao && temPdf
            ? "Os dados foram salvos, mas o novo PDF não foi enviado. O arquivo anterior continua valendo."
            : `Seus dados foram salvos, mas falta enviar o PDF. ${erroPdf}`,
        );
        router.push(DESTINO);
        return;
      }
    }

    toast.success(edicao ? "Trabalho atualizado." : "Trabalho enviado com sucesso!");
    router.push(DESTINO);
  }

  const campoErro = (campo: string) =>
    erros[campo] ? (
      <p id={`erro-${campo}`} className="text-sm text-destructive">
        {erros[campo]}
      </p>
    ) : null;
  const aria = (campo: string) => ({
    "aria-invalid": erros[campo] ? true : undefined,
    "aria-describedby": erros[campo] ? `erro-${campo}` : undefined,
  });

  return (
    <form onSubmit={enviar} className="space-y-6" noValidate>
      <div className="space-y-2">
        <Label htmlFor="titulo" className="text-base">Título do trabalho</Label>
        <Input
          id="titulo"
          value={v.titulo}
          onChange={(e) => alterar("titulo", e.target.value)}
          maxLength={300}
          disabled={enviando}
          className="h-11 text-base"
          {...aria("titulo")}
        />
        {campoErro("titulo")}
      </div>

      <div className="space-y-2">
        <Label htmlFor="resumo" className="text-base">Resumo</Label>
        <Textarea
          id="resumo"
          value={v.resumo}
          onChange={(e) => alterar("resumo", e.target.value)}
          rows={8}
          maxLength={5000}
          disabled={enviando}
          className="text-base"
          {...aria("resumo")}
        />
        <p className="text-sm text-muted-foreground">
          {v.resumo.trim().length} de 5000 caracteres (mínimo 50)
        </p>
        {campoErro("resumo")}
      </div>

      <div className="space-y-2">
        <Label htmlFor="palavras" className="text-base">Palavras-chave (opcional)</Label>
        <Input
          id="palavras"
          value={v.palavrasChave}
          onChange={(e) => alterar("palavrasChave", e.target.value)}
          maxLength={300}
          placeholder="Separe por vírgulas"
          disabled={enviando}
          className="h-11 text-base"
          {...aria("palavrasChave")}
        />
        {campoErro("palavrasChave")}
      </div>

      {areas.length > 0 && (
        <div className="space-y-2">
          <span id="rotulo-area" className="text-base font-medium">Área temática</span>
          <Select
            items={opcoesArea}
            value={v.area || null}
            onValueChange={(x) => alterar("area", x ?? "")}
            disabled={enviando}
          >
            <SelectTrigger aria-labelledby="rotulo-area" className="h-11 w-full text-base" {...aria("area")}>
              <SelectValue placeholder="Escolha a área" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {opcoesArea.map((o) => (
                <SelectItem key={o.value} value={o.value} className="min-h-10 text-base">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {campoErro("area")}
        </div>
      )}

      <div className="space-y-2">
        <span id="rotulo-modalidade" className="text-base font-medium">Modalidade</span>
        <Select
          items={opcoesModalidade}
          value={v.modalidade}
          onValueChange={(x) => x && alterar("modalidade", x as ModalidadeTrabalho)}
          disabled={enviando}
        >
          <SelectTrigger aria-labelledby="rotulo-modalidade" className="h-11 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {opcoesModalidade.map((o) => (
              <SelectItem key={o.value} value={o.value} className="min-h-10 text-base">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {campoErro("modalidade")}
      </div>

      <fieldset className="space-y-3" disabled={enviando}>
        <legend className="text-base font-medium">Coautores (opcional)</legend>
        <p className="text-sm text-muted-foreground">
          Nome completo de cada coautor, como deve aparecer no certificado.
        </p>
        {v.coautores.map((nome, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={nome}
              onChange={(e) => alterarCoautor(i, e.target.value)}
              maxLength={150}
              aria-label={`Nome do coautor ${i + 1}`}
              className="h-11 text-base"
            />
            <Button
              type="button"
              variant="outline"
              className="size-11"
              aria-label={`Remover coautor ${i + 1}`}
              onClick={() => alterar("coautores", v.coautores.filter((_, j) => j !== i))}
            >
              <X aria-hidden />
            </Button>
          </div>
        ))}
        {campoErro("coautores")}
        <Button
          type="button"
          variant="outline"
          className="h-11 text-base"
          disabled={v.coautores.length >= MAX_COAUTORES}
          onClick={() => alterar("coautores", [...v.coautores, ""])}
        >
          <Plus aria-hidden /> Adicionar coautor
        </Button>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="arquivo" className="text-base">
          {edicao ? "Trocar o PDF (opcional)" : "Arquivo PDF"}
        </Label>
        {edicao && (
          <p className="text-sm text-muted-foreground">
            {temPdf ? "Seu PDF atual será mantido se você não escolher outro." : "Este trabalho ainda não tem PDF."}
          </p>
        )}
        <Input
          id="arquivo"
          type="file"
          accept="application/pdf,.pdf"
          disabled={enviando}
          onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
          className="h-auto py-2 text-base"
          {...aria("arquivo")}
        />
        <p className="text-sm text-muted-foreground">Somente PDF, de até 10 MB.</p>
        {campoErro("arquivo")}
      </div>

      <div className="space-y-2" aria-live="polite">
        <Button type="submit" className="h-12 w-full text-base" disabled={enviando}>
          {etapa === "dados"
            ? "Enviando dados…"
            : etapa === "pdf"
              ? "Enviando PDF…"
              : edicao
                ? "Salvar alterações"
                : "Enviar trabalho"}
        </Button>
        {etapa === "pdf" && (
          <p className="text-center text-sm text-muted-foreground">
            Não feche esta página até terminar.
          </p>
        )}
      </div>
    </form>
  );
}
