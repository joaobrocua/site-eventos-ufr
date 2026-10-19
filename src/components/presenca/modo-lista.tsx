"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatarHora } from "@/lib/datas";
import { filtrarPorBusca } from "@/lib/presenca/busca";
import type { Inscrito } from "@/lib/presenca/tipos";

type Props = {
  inscritos: Inscrito[];
  onAlternar: (inscricaoId: string, presente: boolean) => void;
};

export function ModoLista({ inscritos, onAlternar }: Props) {
  const [busca, setBusca] = useState("");
  const [soAusentes, setSoAusentes] = useState(false);

  const visiveis = useMemo(() => {
    const base = soAusentes ? inscritos.filter((i) => !i.presenteEm) : inscritos;
    return filtrarPorBusca(base, busca);
  }, [inscritos, busca, soAusentes]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou RGA"
          aria-label="Buscar por nome ou RGA"
          autoComplete="off"
          className="h-12 pl-10 text-base"
        />
      </div>

      <label className="flex h-12 cursor-pointer items-center gap-3 text-base">
        <Checkbox
          checked={soAusentes}
          onCheckedChange={(v) => setSoAusentes(v === true)}
          className="size-6"
        />
        Só ausentes
      </label>

      {inscritos.length === 0 ? (
        <p className="rounded-xl border p-6 text-center text-base text-muted-foreground">
          Ninguém está inscrito nesta atividade ainda.
        </p>
      ) : visiveis.length === 0 ? (
        <p className="rounded-xl border p-6 text-center text-base text-muted-foreground">
          Ninguém encontrado com esse filtro.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((i) => {
            const presente = i.presenteEm !== null;
            return (
              <li key={i.inscricaoId}>
                <label
                  className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                    presente ? "border-success/40 bg-success/10" : "bg-card"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base leading-tight font-semibold">{i.nome}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[i.rga && `RGA ${i.rga}`, i.curso].filter(Boolean).join(" · ") || "Sem RGA"}
                    </span>
                    {presente && i.presenteEm && (
                      <span className="block text-sm font-medium text-success">
                        Presente às {formatarHora(i.presenteEm)}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-base font-medium">
                    Presente
                    <Checkbox
                      checked={presente}
                      onCheckedChange={(v) => onAlternar(i.inscricaoId, v === true)}
                      className="size-8 rounded-md [&_svg]:size-6!"
                    />
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
