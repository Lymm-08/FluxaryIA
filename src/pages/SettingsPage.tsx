import { useState } from "react";
import { AlertCircle, CircleHelp, KeyRound, Moon, RotateCcw, ShieldCheck, Sun, Trash2 } from "lucide-react";
import type { DashboardWidget } from "../types/finance";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { requestAccountDeletion } from "../services/accountDeletion";

type SettingsPageProps = {
  email: string | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  dashboardWidgets: DashboardWidget[];
  onToggleDashboardWidget: (widget: DashboardWidget) => void;
  onSendPasswordReset: (email: string) => Promise<void>;
  onResetBalance: () => void;
};

// Preferências do tema e segurança da conta.
export function SettingsPage({ email, darkMode, onToggleDarkMode, dashboardWidgets, onToggleDashboardWidget, onSendPasswordReset, onResetBalance }: SettingsPageProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false);
  const [deletionRequestSent, setDeletionRequestSent] = useState(false);
  const [deletionRequestMessage, setDeletionRequestMessage] = useState("");
  const [deletionRequestError, setDeletionRequestError] = useState("");

  async function requestPasswordReset() {
    setMessage("");
    setError("");
    if (!email) return;
    setBusy(true);
    try {
      await onSendPasswordReset(email);
      setMessage("Enviamos um código de recuperação para seu e-mail.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar o código de recuperação.");
    } finally {
      setBusy(false);
    }
  }

  async function submitDeletionRequest() {
    setDeleteRequestOpen(false);
    setDeletionRequestMessage("");
    setDeletionRequestError("");
    setBusy(true);
    try {
      await requestAccountDeletion();
      setDeletionRequestSent(true);
      setDeletionRequestMessage("Enviamos um link de confirmação para seu e-mail. A conta ainda não foi excluída.");
    } catch (reason) {
      setDeletionRequestError(reason instanceof Error ? reason.message : "Não foi possível solicitar a exclusão da conta.");
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
            <div className="settings-password-form">
              {message && <div className="auth-feedback auth-feedback-success" role="status"><ShieldCheck size={16} /><span>{message}</span></div>}
              {error && <div className="auth-feedback auth-feedback-error" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
              <button className="button-primary" type="button" onClick={() => void requestPasswordReset()} disabled={busy}>
                <KeyRound size={14} />{busy ? "Enviando..." : "Redefinir senha por e-mail"}
              </button>
              <div className="settings-delete-account">
                <h3>Excluir minha conta</h3>
                <p>A solicitação envia um link ao seu e-mail. Sua conta só será excluída depois de confirmar pelo link e aceitar a confirmação final.</p>
                {deletionRequestMessage && (
                  <div className="auth-feedback auth-feedback-success" role="status">
                    <ShieldCheck size={16} /><span>{deletionRequestMessage}</span>
                  </div>
                )}
                {deletionRequestError && <div className="auth-feedback auth-feedback-error" role="alert"><AlertCircle size={16} /><span>{deletionRequestError}</span></div>}
                <button
                  className="button-danger"
                  type="button"
                  onClick={() => setDeleteRequestOpen(true)}
                  disabled={busy || deletionRequestSent}
                >
                  <Trash2 size={14} />{busy ? "Enviando solicitação..." : "Excluir minha conta"}
                </button>
              </div>
            </div>
          ) : <div className="settings-local-note">A conta atual não possui um endereço de e-mail associado.</div>}
        </article>
        <article className="panel settings-card settings-reset-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><RotateCcw size={17} /></span>
            <div><h2>Saldo do mês</h2><p>Zere o saldo e apague as receitas e despesas deste mês. O histórico de outros meses será preservado.</p></div>
          </div>
          <button className="button-secondary settings-reset-button" type="button" onClick={onResetBalance}>
            <RotateCcw size={14} /> Zerar saldo do mês
          </button>
        </article>
        <article className="panel settings-card settings-help-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><CircleHelp size={17} /></span>
            <div><h2>Central de ajuda</h2><p>Encontre orientações rápidas para usar seus recursos financeiros.</p></div>
          </div>
          <div className="settings-help-list">
            <details className="settings-help-item">
              <summary>Como registrar uma receita ou despesa?</summary>
              <p>Toque em “Novo lançamento”, escolha receita ou despesa, informe o valor e a categoria. Para movimentações fora do cartão, selecione a conta correspondente.</p>
            </details>
            <details className="settings-help-item">
              <summary>Como funcionam as Caixinhas?</summary>
              <p>Ao guardar dinheiro, o valor é transferido da conta selecionada para a Caixinha. Ao retirar, escolha a conta que receberá o valor. As duas operações aparecem em Movimentações e não são receitas ou despesas.</p>
            </details>
            <details className="settings-help-item">
              <summary>Como confirmar uma movimentação agendada?</summary>
              <p>Abra o sino de notificações e marque a receita como recebida ou a despesa como paga. Até a confirmação, ela não altera o saldo atual.</p>
            </details>
          </div>
        </article>
      </div>
      {deleteRequestOpen && (
        <ConfirmDialog
          title="Solicitar exclusão da conta?"
          message="A exclusão é permanente e removerá sua conta e os dados associados. Primeiro enviaremos um link para seu e-mail; nada será excluído até você abrir o link e confirmar novamente."
          confirmLabel="Enviar link de confirmação"
          danger
          onConfirm={() => void submitDeletionRequest()}
          onCancel={() => setDeleteRequestOpen(false)}
        />
      )}
    </section>
  );
}
