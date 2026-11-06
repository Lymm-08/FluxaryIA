import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  window.dispatchEvent(new Event("pagehide"));
});

describe("armazenamento da sessão", () => {
  it("usa sessionStorage quando lembrar de mim está desativado", async () => {
    const { authStorage, setRememberSessionPreference } = await import("../src/lib/auth-storage");
    const { authStorageKey } = await import("../src/lib/auth-storage");
    setRememberSessionPreference(false);
    authStorage.setItem(authStorageKey, "session-token");

    expect(sessionStorage.getItem(authStorageKey)).toBe("session-token");
    expect(localStorage.getItem(authStorageKey)).toBeNull();
    expect(sessionStorage.getItem(`fluxary.remember-session:${sessionStorage.getItem("fluxary.auth-tab-id")}`)).toBe("false");
  });

  it("migra tokens para armazenamento local ao ativar lembrar de mim", async () => {
    const {
      authStorage,
      authStorageKey,
      rememberCurrentAuthSession,
      setRememberSessionPreference,
    } = await import("../src/lib/auth-storage");
    setRememberSessionPreference(false);
    authStorage.setItem(authStorageKey, "session-token");
    setRememberSessionPreference(true);
    rememberCurrentAuthSession();

    expect(localStorage.getItem(authStorageKey)).toBe("session-token");
    expect(sessionStorage.getItem(authStorageKey)).toBeNull();
    expect(localStorage.getItem("fluxary.remembered-auth-tabs")).toContain(sessionStorage.getItem("fluxary.auth-tab-id"));
  });

  it("restaura a preferência salva após recarregar o módulo", async () => {
    const { authStorageKey, setRememberSessionPreference } = await import("../src/lib/auth-storage");
    setRememberSessionPreference(true);
    localStorage.setItem("sb-other-tab-auth-token", "other-tab-token");
    const { clearAuthSession } = await import("../src/lib/auth-storage");
    clearAuthSession();
    expect(localStorage.getItem("sb-other-tab-auth-token")).toBe("other-tab-token");
    window.dispatchEvent(new Event("pagehide"));
    vi.resetModules();
    const restored = await import("../src/lib/auth-storage");

    expect(restored.getRememberSessionPreference()).toBe(true);
    expect(restored.authStorageKey).toBe(authStorageKey);
  });

  it("recupera o token local lembrado em uma nova aba sem reutilizar o armazenamento da aba anterior", async () => {
    const {
      authStorage,
      authStorageKey,
      authTabId,
      rememberCurrentAuthSession,
      setRememberSessionPreference,
    } = await import("../src/lib/auth-storage");
    setRememberSessionPreference(true);
    authStorage.setItem(authStorageKey, "opaque-session");
    rememberCurrentAuthSession();
    window.dispatchEvent(new Event("pagehide"));
    sessionStorage.clear();
    vi.resetModules();

    const restored = await import("../src/lib/auth-storage");

    expect(restored.authTabId).toBe(authTabId);
    expect(restored.getRememberSessionPreference()).toBe(true);
    expect(restored.authStorage.getItem(restored.authStorageKey)).toBe("opaque-session");
  });
});
