import Image from "next/image";
import Link from "next/link";
import { obterPapel, obterUsuario } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function Cabecalho() {
  const [usuario, papel] = await Promise.all([obterUsuario(), obterPapel()]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      {/* Faixa com as três cores do logo da UFR */}
      <div className="flex h-1" aria-hidden>
        <span className="flex-1 bg-[var(--ufr-marinho)]" />
        <span className="flex-1 bg-[var(--ufr-azul)]" />
        <span className="flex-1 bg-[var(--ufr-verde)]" />
      </div>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Eventos UFR, página inicial">
          <Image src="/marca-ufr.png" alt="" width={366} height={412} className="h-9 w-auto" priority />
          <span className="leading-tight">
            <span className="block font-semibold tracking-tight">
              Eventos <span className="text-primary">UFR</span>
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              Universidade Federal de Rondonópolis
            </span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Principal">
          <Button variant="ghost" size="sm" render={<Link href="/" />} nativeButton={false}>
            Eventos
          </Button>
          {usuario && (
            <Button variant="ghost" size="sm" render={<Link href="/minha-area" />} nativeButton={false}>
              Minha área
            </Button>
          )}
          {papel && (
            <Button variant="ghost" size="sm" render={<Link href="/painel" />} nativeButton={false}>
              Painel
            </Button>
          )}
          {usuario ? (
            <form action="/auth/sair" method="post">
              <Button variant="outline" size="sm" type="submit">
                Sair
              </Button>
            </form>
          ) : (
            <Button size="sm" render={<Link href="/entrar" />} nativeButton={false}>
              Entrar
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
