import { useState, type FormEvent } from "react";
import { KeyRound, Moon, RotateCcw, ShieldCheck, Sun } from "lucide-react";
import type { DashboardWidget } from "../types/finance";

type SettingsPageProps = {
  email: string | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  dashboardWidgets: DashboardWidget[];
  onToggleDashboardWidget: (widget: DashboardWidget) => void;
  onUpdatePassword: (password: string) => Promise<void>;
  onResetBalance: () => void;
};

// Preferências do tema e segurança da conta.
export function SettingsPage({ email, darkMode, onToggleDarkMode, dashboardWidgets, onToggleDashboardWidget, onUpdatePassword, onResetBalance }: SettingsPageProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("password-confirm") ?? "")) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      await onUpdatePassword(password);
      setMessage("Senha atualizada com sucesso.");
      event.currentTarget.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section-page settings-page">
      <div className="eyebrow">PREFERÊNCIAS</div>
      <h1>Configurações</h1>
      <p className="section-description">Personalize sua experiência e gerencie a segurança da conta.</p>
      <div className="settings-grid">
        <article className="panel settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon">{darkMode ? <Moon size={17} /> : <Sun size={17} />}</span>
            <div><h2>Aparência</h2><p>Escolha como o Fluxary.ia aparece para você.</p></div>
          </div>
          <label className="theme-setting">
            <span><strong>Modo escuro</strong><small>Reduz o brilho da interface.</small></span>
            <input type="checkbox" role="switch" checked={darkMode} onChange={onToggleDarkMode} />
          </label>
        </article>
        <article className="panel settings-card dashboard-preferences-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><Sun size={17} /></span>
            <div><h2>Tela inicial</h2><p>Escolha quais blocos opcionais aparecem na visão geral.</p></div>
          </div>
          <div className="dashboard-widget-settings">
            <label className="theme-setting">
              <span><strong>Limite dos cartões</strong><small>Mostra o limite disponível e o valor utilizado.</small></span>
              <input type="checkbox" checked={dashboardWidgets.includes("cards")} onChange={() => onToggleDashboardWidget("cards")} />
            </label>
            <label className="theme-setting">
              <span><strong>Metas financeiras</strong><small>Mostra suas metas e o progresso.</small></span>
              <input type="checkbox" checked={dashboardWidgets.includes("goals")} onChange={() => onToggleDashboardWidget("goals")} />
            </label>
            <p className="dashboard-widget-note">Receitas e despesas do mês permanecem sempre visíveis.</p>
          </div>
        </article>
        <article className="panel settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><ShieldCheck size={17} /></span>
            <div><h2>Conta e segurança</h2><p>{email ? `Conta conectada: ${email}` : "Conta Fluxary.ia conectada."}</p></div>
          </div>
          {email ? (
            <form className="settings-password-form" onSubmit={changePassword}>
              {message && <div className="auth-success" role="status">{message}</div>}
              {error && <div className="auth-message" role="alert">{error}</div>}
              <label>Nova senha<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
              <label>Confirme a nova senha<input name="password-confirm" type="password" minLength={8} required autoComplete="new-password" /></label>
              <button className="button-primary" type="submit" disabled={busy}><KeyRound size={14} />{busy ? "Salvando..." : "Alterar senha"}</button>
            </form>
          ) : <div className="settings-local-note">A conta atual não possui um endereço de e-mail associado.</div>}
        </article>
        <article className="panel settings-card settings-reset-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><RotateCcw size={17} /></span>
            <div><h2>Saldo do mês</h2><p>Zere o saldo atual sem apagar lançamentos nem alterar o histórico.</p></div>
          </div>
          <button className="button-secondary settings-reset-button" type="button" onClick={onResetBalance}>
            <RotateCcw size={14} /> Zerar saldo do mês
          </button>
        </article>
      </div>
    </section>
  );
}
