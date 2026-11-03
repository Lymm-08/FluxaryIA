import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.resetModules();
});

describe("armazenamento da sessão", () => {
  it("usa sessionStorage quando lembrar de mim está desativado", async () => {
    const { authStorage, setRememberSessionPreference } = await import("../src/lib/auth-storage");
    setRememberSessionPreference(false);
    authStorage.setItem("sb-project-auth-token", "session-token");

    expect(sessionStorage.getItem("sb-project-auth-token")).toBe("session-token");
    expect(localStorage.getItem("sb-project-auth-token")).toBeNull();
    expect(localStorage.getItem("fluxary.remember-session")).toBe("false");
  });

  it("migra tokens para armazenamento local ao ativar lembrar de mim", async () => {
    const { authStorage, setRememberSessionPreference } = await import("../src/lib/auth-storage");
    setRememberSessionPreference(false);
    authStorage.setItem("sb-project-auth-token", "session-token");
    setRememberSessionPreference(true);

    expect(localStorage.getItem("sb-project-auth-token")).toBe("session-token");
    expect(sessionStorage.getItem("sb-project-auth-token")).toBeNull();
  });

  it("restaura a preferência salva após recarregar o módulo", async () => {
    const { setRememberSessionPreference } = await import("../src/lib/auth-storage");
    setRememberSessionPreference(true);
    vi.resetModules();
    const restored = await import("../src/lib/auth-storage");

    expect(restored.getRememberSessionPreference()).toBe(true);
  });
});
