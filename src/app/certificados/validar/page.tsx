import type { Metadata } from "next";
import { FormValidar } from "./form-validar";

export const metadata: Metadata = { title: "Validar certificado" };

export default function PaginaValidar() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12 sm:py-20">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Validar certificado</h1>
        <p className="text-muted-foreground">
          Qualquer pessoa pode conferir se um certificado é autêntico. Digite o código que aparece
          no documento.
        </p>
      </div>
      <FormValidar />
    </div>
  );
}
