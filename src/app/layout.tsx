import type { Metadata, Viewport } from "next";
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
  themeColor: "#2f4fb3",
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
        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          Universidade Federal de Rondonópolis · Plataforma de eventos
        </footer>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
