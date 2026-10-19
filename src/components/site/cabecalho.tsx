import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { obterPapel, obterUsuario } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function Cabecalho() {
  const [usuario, papel] = await Promise.all([obterUsuario(), obterPapel()]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <CalendarDays className="size-5" aria-hidden />
          </span>
          <span className="leading-tight">
            Eventos <span className="text-primary">UFR</span>
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
