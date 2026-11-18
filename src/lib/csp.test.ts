import { describe, expect, it } from "vitest";
import { gerarNonce, montarCsp } from "./csp";

const diretiva = (csp: string, nome: string) =>
  csp.split("; ").find((d) => d.startsWith(`${nome} `)) ?? "";

describe("montarCsp", () => {
  const base = {
    nonce: "abc123",
    supabaseUrl: "https://projeto.supabase.co/",
    siteUrl: "https://eventos.ufr.edu.br",
    desenvolvimento: false,
  };

  it("scripts só com o nonce da requisição (sem unsafe-inline nem unsafe-eval em produção)", () => {
    const s = diretiva(montarCsp(base), "script-src");
    expect(s).toContain("'nonce-abc123'");
    expect(s).toContain("'strict-dynamic'");
    expect(s).toContain("'wasm-unsafe-eval'");
    expect(s).not.toContain("'unsafe-inline'");
    expect(s).not.toContain("'unsafe-eval'");
  });

  it("libera conexão só com o próprio site e com a origem do Supabase", () => {
    expect(diretiva(montarCsp(base), "connect-src")).toBe("connect-src 'self' https://projeto.supabase.co");
  });

  it("não deixa o site ser embutido em outro e não carrega plugins", () => {
    const csp = montarCsp(base);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("libera o bip do leitor de QR (áudio data:) e a câmera (blob:)", () => {
    expect(diretiva(montarCsp(base), "media-src")).toBe("media-src 'self' data: blob:");
  });

  it("upgrade-insecure-requests só em https", () => {
    expect(montarCsp(base)).toContain("upgrade-insecure-requests");
    expect(montarCsp({ ...base, siteUrl: "http://localhost:3000" })).not.toContain("upgrade-insecure-requests");
  });

  it("desenvolvimento libera eval (React) e websocket (recarregamento)", () => {
    const csp = montarCsp({ ...base, desenvolvimento: true, supabaseUrl: "http://127.0.0.1:55421" });
    expect(diretiva(csp, "script-src")).toContain("'unsafe-eval'");
    expect(diretiva(csp, "connect-src")).toBe("connect-src 'self' http://127.0.0.1:55421 ws:");
  });

  it("URL do Supabase ausente ou inválida não quebra a política", () => {
    expect(diretiva(montarCsp({ ...base, supabaseUrl: undefined }), "connect-src")).toBe("connect-src 'self'");
    expect(diretiva(montarCsp({ ...base, supabaseUrl: "não é url" }), "connect-src")).toBe("connect-src 'self'");
  });
});

describe("gerarNonce", () => {
  it("é diferente a cada chamada e tem 128 bits", () => {
    const a = gerarNonce();
    expect(a).not.toBe(gerarNonce());
    expect(atob(a)).toHaveLength(16);
  });
});
