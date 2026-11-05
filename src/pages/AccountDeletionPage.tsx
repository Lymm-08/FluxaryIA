import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, ShieldAlert, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { supabase } from "../lib/supabase";
import { clearAuthSession } from "../lib/auth-storage";
import {
  confirmAccountDeletion,
  validateAccountDeletionToken,
} from "../services/accountDeletion";

type PageState = "loading" | "ready" | "expired" | "invalid" | "used" | "deleting" | "complete" | "error";

export function AccountDeletionPage({ token, completed = false }: { token: string; completed?: boolean }) {
  const [state, setState] = useState<PageState>(completed ? "complete" : "loading");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (completed) return;
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
  }, [completed, token]);

  async function deleteAccount() {
    setConfirming(false);
    setError("");
    setState("deleting");
    try {
      await confirmAccountDeletion(token);
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
        {state === "loading" || state === "deleting" ? (
          <>
            <span className="account-deletion-icon"><LoaderCircle className="account-deletion-spinner" size={24} /></span>
            <h1>{state === "loading" ? "Validando seu link" : "Excluindo sua conta"}</h1>
            <p>{state === "loading" ? "Aguarde enquanto confirmamos a validade do link." : "Estamos removendo seus arquivos e dados associados."}</p>
          </>
        ) : null}
        {state === "ready" ? (
          <>
            <span className="account-deletion-icon account-deletion-icon-danger"><ShieldAlert size={24} /></span>
            <h1>Confirme a exclusão da sua conta</h1>
            <p>Esta ação excluirá permanentemente sua conta Fluxary, seus dados financeiros e os arquivos associados. Não será possível desfazê-la.</p>
            <p>A abertura do link não excluiu sua conta. A exclusão só acontecerá após sua confirmação abaixo.</p>
            <button className="button-danger" type="button" onClick={() => setConfirming(true)}>
              <Trash2 size={15} /> Excluir minha conta permanentemente
            </button>
          </>
        ) : null}
        {state === "expired" ? (
          <>
            <span className="account-deletion-icon account-deletion-icon-danger"><AlertCircle size={24} /></span>
            <h1>Este link expirou</h1>
            <p>O link de confirmação é válido por 30 minutos. Entre na sua conta e solicite um novo e-mail.</p>
            <a className="account-deletion-back" href="/">Voltar ao Fluxary</a>
          </>
        ) : null}
        {state === "invalid" || state === "used" ? (
          <>
            <span className="account-deletion-icon account-deletion-icon-danger"><AlertCircle size={24} /></span>
            <h1>{state === "used" ? "Este link já foi utilizado" : "Este link não é válido"}</h1>
            <p>O link pode ter sido usado, substituído por uma solicitação mais recente ou estar incorreto. Se ainda desejar excluir sua conta, faça uma nova solicitação autenticada.</p>
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
