import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Cabecalho } from "@/components/site/cabecalho";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Eventos UFR",
    template: "%s · Eventos UFR",
  },
  description: "Inscrições, programação e presença dos eventos acadêmicos da UFR.",
};

export const viewport: Viewport = {
  themeColor: "#22376b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Cabecalho />
        <main className="flex-1">{children}</main>
        <footer className="border-t bg-card">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
            <a href="https://ufr.edu.br/" target="_blank" rel="noopener noreferrer" className="shrink-0">
              {/* Logo com texto escuro: no tema escuro fica sobre um fundo branco */}
              <span className="inline-block rounded-md bg-white p-1.5">
                <Image
                  src="/logo-ufr.png"
                  alt="Universidade Federal de Rondonópolis"
                  width={715}
                  height={544}
                  className="h-12 w-auto"
                />
              </span>
            </a>
            <p>
              Plataforma de eventos acadêmicos da UFR ·{" "}
              <a href="https://ufr.edu.br/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
                ufr.edu.br
              </a>
            </p>
          </div>
        </footer>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
