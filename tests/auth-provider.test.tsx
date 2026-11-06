import { act, renderHook, waitFor } from "@testing-library/react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  setRememberSessionPreference: vi.fn(),
  rememberCurrentAuthSession: vi.fn(),
  clearRememberedAuthSession: vi.fn(),
}));

vi.mock("../src/lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: authMocks.onAuthStateChange,
      getSession: authMocks.getSession,
      signInWithPassword: authMocks.signInWithPassword,
      signOut: authMocks.signOut,
    },
  },
  supabaseConfigured: true,
}));

vi.mock("../src/lib/auth-storage", () => ({
  setRememberSessionPreference: authMocks.setRememberSessionPreference,
  rememberCurrentAuthSession: authMocks.rememberCurrentAuthSession,
  clearRememberedAuthSession: authMocks.clearRememberedAuthSession,
}));

import { AuthProvider, useAuth } from "../src/auth/AuthProvider";

afterEach(() => {
  vi.clearAllMocks();
});

describe("provedor de autenticação", () => {
  it("mantém o login e encerra apenas a sessão desta aba", async () => {
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMocks.signInWithPassword.mockResolvedValue({ error: null });
    authMocks.signOut.mockResolvedValue({ error: null });

    const hook = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    await act(async () => {
      await hook.result.current.signIn("user@example.com", "password", true);
      await hook.result.current.signOut();
    });

    expect(authMocks.setRememberSessionPreference).toHaveBeenCalledWith(true);
    expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password",
    });
    expect(authMocks.rememberCurrentAuthSession).toHaveBeenCalledOnce();
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(authMocks.clearRememberedAuthSession).toHaveBeenCalledOnce();
    hook.unmount();
  });

  it("não restaura uma sessão obsoleta se um evento de autenticação chegar durante a inicialização", async () => {
    let resolveSession!: (result: { data: { session: Session | null }; error: null }) => void;
    authMocks.onAuthStateChange.mockImplementation((callback: (event: AuthChangeEvent, session: Session | null) => void) => {
      callback("SIGNED_OUT", null);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    authMocks.getSession.mockReturnValue(new Promise((resolve) => {
      resolveSession = resolve;
    }));

    const hook = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      resolveSession({
        data: { session: { user: { id: "stale-user" } } as Session },
        error: null,
      });
    });

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.user).toBeNull();
    hook.unmount();
  });
});
