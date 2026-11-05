import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDeletionPage } from "../src/pages/AccountDeletionPage";
import { SettingsPage } from "../src/pages/SettingsPage";

const deletionServices = vi.hoisted(() => ({
  requestAccountDeletion: vi.fn(),
  validateAccountDeletionToken: vi.fn(),
  confirmAccountDeletion: vi.fn(),
  signOut: vi.fn(),
  clearAuthSession: vi.fn(),
}));

vi.mock("../src/services/accountDeletion", () => ({
  requestAccountDeletion: deletionServices.requestAccountDeletion,
  validateAccountDeletionToken: deletionServices.validateAccountDeletionToken,
  confirmAccountDeletion: deletionServices.confirmAccountDeletion,
}));

vi.mock("../src/lib/supabase", () => ({
  supabase: { auth: { signOut: deletionServices.signOut } },
}));

vi.mock("../src/lib/auth-storage", () => ({
  clearAuthSession: deletionServices.clearAuthSession,
  authStorage: {},
  setRememberSessionPreference: vi.fn(),
}));

const settingsProps = {
  email: "person@example.com",
  darkMode: false,
  onToggleDarkMode: vi.fn(),
  dashboardWidgets: ["cards", "goals"] as ("cards" | "goals")[],
  onToggleDashboardWidget: vi.fn(),
  onSendPasswordReset: vi.fn().mockResolvedValue(undefined),
  onResetBalance: vi.fn(),
};

describe("Confirmação de exclusão de conta", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    deletionServices.requestAccountDeletion.mockResolvedValue(undefined);
    deletionServices.validateAccountDeletionToken.mockResolvedValue("valid");
    deletionServices.confirmAccountDeletion.mockResolvedValue(undefined);
    deletionServices.signOut.mockResolvedValue({ error: null });
  });

  it("solicita confirmação antes de enviar o e-mail e mantém a conta ativa", async () => {
    const user = userEvent.setup();
    render(<SettingsPage {...settingsProps} />);

    await user.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText(/nada será excluído até você abrir o link/i)).toBeTruthy();
    expect(deletionServices.requestAccountDeletion).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Enviar link de confirmação" }));
    await waitFor(() => expect(deletionServices.requestAccountDeletion).toHaveBeenCalledOnce());
    expect(await screen.findByText(/A conta ainda não foi excluída/)).toBeTruthy();
  });

  it("mostra erros ao falhar o envio da solicitação", async () => {
    deletionServices.requestAccountDeletion.mockRejectedValueOnce(new Error("E-mail não enviado."));
    const user = userEvent.setup();
    render(<SettingsPage {...settingsProps} />);

    await user.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    await user.click(await screen.findByRole("button", { name: "Enviar link de confirmação" }));

    expect((await screen.findByRole("alert")).textContent).toContain("E-mail não enviado.");
  });

  it("não exclui a conta ao abrir o link e requer confirmação final", async () => {
    const user = userEvent.setup();
    render(<AccountDeletionPage token={"a".repeat(43)} />);

    expect(await screen.findByRole("heading", { name: "Confirme a exclusão da sua conta" })).toBeTruthy();
    expect(deletionServices.confirmAccountDeletion).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Excluir minha conta permanentemente" }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(deletionServices.confirmAccountDeletion).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => expect(deletionServices.confirmAccountDeletion).toHaveBeenCalledOnce());
    expect(await screen.findByRole("heading", { name: "Conta excluída" })).toBeTruthy();
    expect(deletionServices.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(window.location.search).toContain("accountDeletionComplete=1");
  });

  it("limpa o token local mesmo se a sessão Supabase não puder ser encerrada", async () => {
    deletionServices.signOut.mockRejectedValueOnce(new Error("Sessão indisponível."));
    const user = userEvent.setup();
    render(<AccountDeletionPage token={"c".repeat(43)} />);

    await user.click(await screen.findByRole("button", { name: "Excluir minha conta permanentemente" }));
    await user.click(screen.getByRole("button", { name: "Confirmar exclusão" }));

    expect(await screen.findByRole("heading", { name: "Conta excluída" })).toBeTruthy();
    expect(deletionServices.clearAuthSession).toHaveBeenCalledOnce();
  });

  it.each([
    ["expired", "Este link expirou"],
    ["invalid", "Este link não é válido"],
    ["used", "Este link já foi utilizado"],
  ] as const)("apresenta o estado seguro para token %s", async (status, heading) => {
    deletionServices.validateAccountDeletionToken.mockResolvedValueOnce(status);
    render(<AccountDeletionPage token={"b".repeat(43)} />);

    expect(await screen.findByRole("heading", { name: heading })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Excluir minha conta permanentemente" })).toBeNull();
    expect(deletionServices.confirmAccountDeletion).not.toHaveBeenCalled();
  });
});