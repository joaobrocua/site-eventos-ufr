import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CertificadoNaoEncontrado() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Certificado não encontrado</h1>
      <p className="text-muted-foreground">Confira se o código foi digitado corretamente.</p>
      <Button className="h-11 text-base" render={<Link href="/certificados/validar" />} nativeButton={false}>
        Tentar outro código
      </Button>
    </div>
  );
}
