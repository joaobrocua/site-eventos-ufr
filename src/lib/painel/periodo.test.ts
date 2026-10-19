import { describe, expect, it } from "vitest";
import { foraDoPeriodo } from "./periodo";

describe("foraDoPeriodo", () => {
  it("aceita dentro do período, incluindo os extremos", () => {
    expect(foraDoPeriodo("2026-11-10", "2026-11-10", "2026-11-12")).toBe(false);
    expect(foraDoPeriodo("2026-11-12", "2026-11-10", "2026-11-12")).toBe(false);
  });
  it("detecta antes, depois e ano errado", () => {
    expect(foraDoPeriodo("2026-11-09", "2026-11-10", "2026-11-12")).toBe(true);
    expect(foraDoPeriodo("2026-11-13", "2026-11-10", "2026-11-12")).toBe(true);
    expect(foraDoPeriodo("2025-11-11", "2026-11-10", "2026-11-12")).toBe(true);
  });
  it("ignora data vazia", () => {
    expect(foraDoPeriodo("", "2026-11-10", "2026-11-12")).toBe(false);
  });
});
