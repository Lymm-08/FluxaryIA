import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.resetModules();
});

describe("login", () => {
  it("passa a escolha de lembrar de mim para a autenticação", async () => {
    localStorage.setItem("fluxary.remember-session", "false");
    const { AuthPage } = await import("../src/auth/AuthPage");
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    render(
      <AuthPage
        configured
        recovery={false}
        recoveryEmail=""
        recoveryStep="code"
        onSignIn={onSignIn}
        onSignUp={vi.fn()}
        onGoogleSignIn={vi.fn()}
        onSendPasswordReset={vi.fn()}
        onVerifyEmailCode={vi.fn()}
        onResendEmailCode={vi.fn()}
        onUpdatePassword={vi.fn()}
        onRecoveryComplete={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    fireEvent.change(screen.getByPlaceholderText("Seu e-mail"), { target: { value: "teste@exemplo.com" } });
    fireEvent.change(screen.getByPlaceholderText("Sua senha"), { target: { value: "senha-segura-123" } });
    await user.click(screen.getByRole("checkbox", { name: "Lembrar de mim" }));
    await user.click(screen.getByRole("button", { name: "Entrar", exact: true }));

    await waitFor(() => {
      expect(onSignIn).toHaveBeenCalledWith("teste@exemplo.com", "senha-segura-123", true);
    });
  });
});
