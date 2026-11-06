import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clientMocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ auth: {} })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: clientMocks.createClient,
}));

beforeEach(() => {
  vi.resetModules();
  clientMocks.createClient.mockClear();
  vi.stubEnv("VITE_SUPABASE_URL", "https://project-ref.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  window.dispatchEvent(new Event("pagehide"));
});

describe("cliente Supabase por aba", () => {
  it("mantém sessão e renovação automática usando storageKey exclusivo da aba", async () => {
    const [{ supabase }, { authStorageKey, authTabId }] = await Promise.all([
      import("../src/lib/supabase"),
      import("../src/lib/auth-storage"),
    ]);

    expect(supabase).not.toBeNull();
    expect(clientMocks.createClient).toHaveBeenCalledOnce();
    const [, , options] = clientMocks.createClient.mock.calls[0];
    expect(options.auth).toMatchObject({
      autoRefreshToken: true,
      persistSession: true,
      storageKey: `sb-project-ref-auth-token-${authTabId}`,
    });
    expect(authStorageKey).toBe(options.auth.storageKey);
  });
});
