"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emailSchema = z.email("Digite um e-mail válido.");
// Igual ao auth.email.max_frequency do Supabase: antes disso o reenvio é recusado.
const ESPERA_REENVIO_S = 30;
// Igual ao auth.email.otp_length do Supabase (8 dígitos: 6 seriam fáceis de chutar).
const TAMANHO_CODIGO = 8;
const SEM_CONEXAO = "Sem conexão. Verifique a internet e tente novamente.";

async function pedirCodigo(email: string): Promise<string | null> {
  try {
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (!error) return null;
    return error.status === 429
      ? "Muitas tentativas. Aguarde um minuto e tente de novo."
      : "Não foi possível enviar o código. Tente novamente.";
  } catch {
    return SEM_CONEXAO;
  }
}

export function FormEntrar({ destino }: { destino: string }) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const valido = emailSchema.safeParse(email.trim().toLowerCase());
    if (!valido.success) {
      setErro(valido.error.issues[0].message);
      return;
    }
    iniciar(async () => {
      const falha = await pedirCodigo(valido.data);
      if (falha) {
        setErro(falha);
        return;
      }
      setEmail(valido.data);
      setEtapa("codigo");
      setEspera(ESPERA_REENVIO_S);
    });
  }

  function reenviar() {
    setErro(null);
    iniciar(async () => {
      const falha = await pedirCodigo(email);
      if (falha) {
        setErro(falha);
        return;
      }
      setCodigo("");
      setEspera(ESPERA_REENVIO_S);
    });
  }

  function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const token = codigo.replace(/\D/g, "");
    if (token.length !== TAMANHO_CODIGO) {
      setErro("O código tem 8 números.");
      return;
    }
    iniciar(async () => {
      let error: unknown;
      try {
        ({ error } = await createClient().auth.verifyOtp({ email, token, type: "email" }));
      } catch {
        setErro(SEM_CONEXAO);
        return;
      }
      if (error) {
        setErro("Código incorreto ou expirado. Confira o e-mail ou peça outro.");
        return;
      }
      // /cadastro manda direto ao destino se o perfil já estiver completo.
      router.replace(`/cadastro?proximo=${encodeURIComponent(destino)}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent>
        {etapa === "email" ? (
          <form onSubmit={enviarCodigo} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Seu e-mail</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 text-base"
                aria-invalid={Boolean(erro)}
                aria-describedby={erro ? "erro-entrar" : undefined}
              />
            </div>
            {erro && (
              <p id="erro-entrar" role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
            <Button type="submit" className="h-11 w-full text-base" disabled={pendente}>
              {pendente ? <Loader2 className="animate-spin" aria-hidden /> : <Mail aria-hidden />}
              Receber código
            </Button>
          </form>
        ) : (
          <form onSubmit={confirmarCodigo} className="space-y-4" noValidate>
            <p className="text-sm text-muted-foreground">
              Enviamos um código para <strong className="text-foreground">{email}</strong>. Ele
              vale por 15 minutos. Confira também a caixa de spam.
            </p>
            <div className="space-y-2">
              <Label htmlFor="codigo">Código de 8 dígitos</Label>
              <Input
                id="codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={TAMANHO_CODIGO}
                placeholder="00000000"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-center font-mono text-2xl tracking-[0.3em]"
                aria-invalid={Boolean(erro)}
                aria-describedby={erro ? "erro-codigo" : undefined}
              />
            </div>
            {erro && (
              <p id="erro-codigo" role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
            <Button type="submit" className="h-11 w-full text-base" disabled={pendente}>
              {pendente && <Loader2 className="animate-spin" aria-hidden />}
              Entrar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              disabled={pendente || espera > 0}
              onClick={reenviar}
            >
              {espera > 0 ? `Reenviar código em ${espera}s` : "Reenviar código"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setEtapa("email");
                setCodigo("");
                setErro(null);
              }}
            >
              <ArrowLeft aria-hidden /> Usar outro e-mail
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
