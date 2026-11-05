import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, ShieldAlert, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { supabase } from "../lib/supabase";
import { clearAuthSession } from "../lib/auth-storage";
import {
  confirmAccountDeletionCode,
  confirmAccountDeletion,
  validateAccountDeletionCode,
  validateAccountDeletionToken,
} from "../services/accountDeletion";

type PageState = "loading" | "validating_code" | "enter_code" | "ready" | "expired" | "invalid" | "used" | "locked" | "deleting" | "complete" | "error";

export function AccountDeletionPage({
  token = "",
  requestId = "",
  completed = false,
}: {
  token?: string;
  requestId?: string;
  completed?: boolean;
}) {
  const [state, setState] = useState<PageState>(() => (
    completed ? "complete" : requestId ? "enter_code" : "loading"
  ));
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (completed || requestId) return;
    window.history.replaceState(window.history.state, "", window.location.pathname);
    if (!token) {
      setState("invalid");
      return;
    }

    let active = true;
    validateAccountDeletionToken(token)
      .then((result) => {
        if (active) setState(result === "valid" ? "ready" : result);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Não foi possível validar o link.");
        setState("error");
      });
    return () => { active = false; };
  }, [completed, requestId, token]);

  async function validateCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setState("validating_code");
    try {
      const result = await validateAccountDeletionCode(requestId, code);
      if (result === "valid") {
        setState("ready");
      } else if (result === "invalid") {
        setError("O código informado não confere. Confira o e-mail e tente novamente.");
        setState("enter_code");
      } else {
        setState(result);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível validar o código.");
      setState("enter_code");
    }
  }

  async function deleteAccount() {
    setConfirming(false);
    setError("");
    setState("deleting");
    try {
      if (requestId) {
        await confirmAccountDeletionCode(requestId, code);
      } else {
        await confirmAccountDeletion(token);
      }
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}?accountDeletionComplete=1`,
      );
      try {
        if (supabase) {
          const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
          if (signOutError) clearAuthSession();
        } else {
          clearAuthSession();
        }
      } catch {
        clearAuthSession();
      }
      setState("complete");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível concluir a exclusão.");
      setState("error");
    }
  }

  return (
    <main className="account-deletion-page">
      <section className="panel account-deletion-card" aria-live="polite">
        {state === "loading" || state === "validating_code" || state === "deleting" ? (
          <>
            <span className="account-deletion-icon"><LoaderCircle className="account-deletion-spinner" size={24} /></span>
            <h1>{state === "deleting" ? "Excluindo sua conta" : state === "validating_code" ? "Validando seu código" : "Validando seu link"}</h1>
            <p>{state === "deleting" ? "Estamos removendo seus arquivos e dados associados." : "Aguarde enquanto confirmamos sua solicitação."}</p>
          </>
        ) : null}
        {state === "enter_code" ? (
          <>
            <span className="account-deletion-icon"><ShieldAlert size={24} /></span>
            <h1>Digite o código de confirmação</h1>
            <p>Enviamos um código de 6 dígitos para o e-mail da sua conta. Ele expira em 30 minutos. Sua conta não será excluída até a confirmação final.</p>
            <form className="account-deletion-code-form" onSubmit={(event) => void validateCode(event)}>
              <label htmlFor="account-deletion-code">Código recebido por e-mail</label>
              <input
                autoComplete="one-time-code"
                autoFocus
                id="account-deletion-code"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              {error && <p className="account-deletion-code-error" role="alert">{error}</p>}
              <button className="button-primary" type="submit" disabled={code.length !== 6}>
                Confirmar código
              </button>
            </form>
          </>
        ) : null}
        {state === "ready" ? (
          <>
            <span className="account-deletion-icon account-deletion-icon-danger"><ShieldAlert size={24} /></span>
            <h1>Confirme a exclusão da sua conta</h1>
            <p>Esta ação excluirá permanentemente sua conta Fluxary, seus dados financeiros e os arquivos associados. Não será possível desfazê-la.</p>
            <p>A confirmação do código não excluiu a conta. A exclusão só acontecerá após sua confirmação abaixo.</p>
            <button className="button-danger" type="button" onClick={() => setConfirming(true)}>
              <Trash2 size={15} /> Excluir minha conta permanentemente
            </button>
          </>
        ) : null}
        {state === "expired" ? (
          <>
            <span className="account-deletion-icon account-deletion-icon-danger"><AlertCircle size={24} /></span>
            <h1>{requestId ? "Este código expirou" : "Este link expirou"}</h1>
            <p>A confirmação é válida por 30 minutos. Entre na sua conta e solicite um novo e-mail.</p>
            <a className="account-deletion-back" href="/">Voltar ao Fluxary</a>
          </>
        ) : null}
        {state === "invalid" || state === "used" ? (
          <>
            <span className="account-deletion-icon account-deletion-icon-danger"><AlertCircle size={24} /></span>
            <h1>{requestId
              ? state === "used" ? "Este código já foi utilizado" : "Esta solicitação não é válida"
              : state === "used" ? "Este link já foi utilizado" : "Este link não é válido"}</h1>
            <p>{requestId
              ? "O código pode ter sido usado, substituído por uma solicitação mais recente ou estar incorreto. Se ainda desejar excluir sua conta, entre novamente e solicite outro código."
              : "O link pode ter sido usado, substituído por uma solicitação mais recente ou estar incorreto. Se ainda desejar excluir sua conta, faça uma nova solicitação autenticada."}</p>
            <a className="account-deletion-back" href="/">Voltar ao Fluxary</a>
          </>
        ) : null}
        {state === "locked" ? (
          <>
            <span className="account-deletion-icon account-deletion-icon-danger"><AlertCircle size={24} /></span>
            <h1>Código bloqueado</h1>
            <p>O código foi digitado incorretamente muitas vezes. Entre na sua conta e solicite um novo código.</p>
            <a className="account-deletion-back" href="/">Voltar ao Fluxary</a>
          </>
        ) : null}
        {state === "complete" ? (
          <>
            <span className="account-deletion-icon account-deletion-icon-success"><CheckCircle2 size={24} /></span>
            <h1>Conta excluída</h1>
            <p>Sua conta Fluxary e os dados associados foram excluídos. Sua sessão também foi encerrada.</p>
            <a className="account-deletion-back" href="/">Ir para o Fluxary</a>
          </>
        ) : null}
        {state === "error" ? (
          <>
            <span className="account-deletion-icon account-deletion-icon-danger"><AlertCircle size={24} /></span>
            <h1>Não foi possível concluir</h1>
            <p role="alert">{error}</p>
            <p>Se o problema persistir, entre em contato com o suporte do Fluxary.</p>
            <a className="account-deletion-back" href="/">Voltar ao Fluxary</a>
          </>
        ) : null}
      </section>
      {confirming && (
        <ConfirmDialog
          title="Excluir sua conta permanentemente?"
          message="Esta ação é irreversível. Sua conta, dados financeiros, histórico do chat e arquivos associados serão removidos."
          confirmLabel="Confirmar exclusão"
          danger
          onConfirm={() => void deleteAccount()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </main>
  );
}
