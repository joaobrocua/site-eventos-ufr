import { describe, expect, it, vi } from "vitest";
import { enviarEmail, escolherTransporte, montarTexto, separarRemetente } from "./transporte";

describe("escolherTransporte", () => {
  it("prefere Resend quando configurado", () => {
    expect(escolherTransporte({ RESEND_API_KEY: "k", EMAIL_FROM: "A <a@x.com>", MAILPIT_URL: "http://m" }).tipo).toBe("resend");
  });
  it("usa Mailpit no desenvolvimento", () => {
    expect(escolherTransporte({ MAILPIT_URL: "http://127.0.0.1:55424/" })).toMatchObject({
      tipo: "mailpit",
      url: "http://127.0.0.1:55424",
    });
  });
  it("sem configuração não finge que enviou", async () => {
    const t = escolherTransporte({});
    expect(t.tipo).toBe("nenhum");
    await expect(enviarEmail({ para: "a@x.com", assunto: "Oi", texto: "t" }, t)).rejects.toThrow();
  });
});

describe("formatação", () => {
  it("separa nome e e-mail do remetente", () => {
    expect(separarRemetente("Eventos UFR <n@x.com>")).toEqual({ Name: "Eventos UFR", Email: "n@x.com" });
    expect(separarRemetente("n@x.com")).toEqual({ Name: "", Email: "n@x.com" });
  });
  it("saúda pelo primeiro nome", () => {
    expect(montarTexto({ para: "a@x.com", nome: "Maria da Silva", assunto: "x", texto: "corpo" })).toMatch(/^Olá, Maria!\n\ncorpo/);
  });
});

describe("enviarEmail", () => {
  it("erro HTTP vira exceção (o e-mail continua pendente)", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    await expect(
      enviarEmail({ para: "a@x.com", assunto: "Oi", texto: "t" }, { tipo: "mailpit", url: "http://m", remetente: "a@x.com" }, fetcher),
    ).rejects.toThrow(/500/);
  });
});
