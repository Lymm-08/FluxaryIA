import { useLayoutEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck, Shield, TrendingUp, UserRound, Zap } from "lucide-react";
import { getRememberSessionPreference } from "../lib/auth-storage";

type AuthPageProps = {
  configured: boolean;
  recovery: boolean;
  recoveryEmail: string;
  recoveryStep: "code" | "password";
  onSignIn: (email: string, password: string, rememberSession: boolean) => Promise<void>;
  onSignUp: (name: string, email: string, password: string) => Promise<boolean>;
  onGoogleSignIn: () => Promise<void>;
  onSendPasswordReset: (email: string) => Promise<void>;
  onVerifyEmailCode: (email: string, token: string, type: "signup" | "recovery") => Promise<void>;
  onResendEmailCode: (email: string, type: "signup" | "recovery") => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
  onRecoveryComplete: () => void;
};

type AuthMode = "login" | "register" | "forgot" | "verify-signup" | "verify-recovery";

// Login, cadastro e recuperação de senha da conta Supabase.
export function AuthPage({
  configured, recovery, recoveryEmail, recoveryStep, onSignIn, onSignUp, onGoogleSignIn, onSendPasswordReset,
  onVerifyEmailCode, onResendEmailCode, onUpdatePassword, onRecoveryComplete,
}: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(getRememberSessionPreference);

  useLayoutEffect(() => {
    if (recovery) setEmail(recoveryEmail);
  }, [recovery, recoveryEmail]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = "light";
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const formEmail = String(form.get("email") ?? email ?? recoveryEmail).trim();
    const formElement = event.currentTarget;
    const emailField = formElement.elements.namedItem("email");
    if (emailField instanceof HTMLInputElement && !emailField.checkValidity()) {
      setError("Digite um endereço de e-mail válido, como nome@exemplo.com.");
      return;
    }
    if (!formElement.checkValidity()) {
      const invalidField = formElement.querySelector(":invalid");
      setError(invalidField instanceof HTMLInputElement && invalidField.name === "otp"
        ? "Digite o código de verificação enviado para seu e-mail."
        : "Confira os campos obrigatórios. A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (!recovery && (mode === "verify-signup" || mode === "verify-recovery") && !formEmail) {
      setError("Informe o e-mail que recebeu o código.");
      return;
    }
    setBusy(true);
    setEmail(formEmail);
    try {
      if (recovery) {
        if (recoveryStep === "code") {
          await onVerifyEmailCode(formEmail, String(form.get("otp") ?? ""), "recovery");
        } else {
          const password = String(form.get("password") ?? "");
          if (password !== String(form.get("password-confirm") ?? "")) throw new Error("As senhas não conferem.");
          await onUpdatePassword(password);
          onRecoveryComplete();
        }
        return;
      }
      if (mode === "verify-signup" || mode === "verify-recovery") {
        await onVerifyEmailCode(formEmail, String(form.get("otp") ?? ""), mode === "verify-signup" ? "signup" : "recovery");
        if (mode === "verify-signup") setMessage("E-mail confirmado! Sua conta está pronta.");
        return;
      }
      if (mode === "forgot") {
        await onSendPasswordReset(formEmail);
        setMode("verify-recovery");
        setMessage("Se esse e-mail estiver cadastrado, enviaremos um código para redefinir sua senha.");
      } else if (mode === "register") {
        const password = String(form.get("password") ?? "");
        if (password !== String(form.get("password-confirm") ?? "")) throw new Error("As senhas não conferem.");
        const hasSession = await onSignUp(String(form.get("name") ?? "").trim(), formEmail, password);
        if (!hasSession) {
          setMode("verify-signup");
          setMessage("Enviamos um código de confirmação para seu e-mail.");
        }
      } else {
        await onSignIn(formEmail, String(form.get("password") ?? ""), rememberSession);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível concluir a solicitação.");
    } finally {
      setBusy(false);
    }
  }

  async function resendCode(type: "signup" | "recovery" = mode === "verify-signup" ? "signup" : "recovery") {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await onResendEmailCode(email, type);
      setMessage("Se o e-mail puder receber um código, enviaremos uma nova mensagem.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível reenviar o código.");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setError("");
    setBusy(true);
    try {
      await onGoogleSignIn();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar com Google.");
      setBusy(false);
    }
  }

  const isCodeVerification = mode === "verify-signup" || mode === "verify-recovery" || (recovery && recoveryStep === "code");
  const title = recovery && recoveryStep === "password" ? "Crie uma nova senha"
    : mode === "verify-signup" ? "Confirme seu e-mail"
      : mode === "verify-recovery" || recovery ? "Verifique seu e-mail"
        : mode === "register" ? "Crie sua conta"
          : mode === "forgot" ? "Recuperar senha" : "Bem-vinda de volta";
  const description = recovery && recoveryStep === "password"
    ? "Escolha uma senha segura para continuar cuidando da sua vida financeira."
    : isCodeVerification
      ? `Digite o código de 6 dígitos enviado para ${recovery ? recoveryEmail : email}.`
      : mode === "register"
        ? "Crie sua conta e comece a cuidar melhor do seu dinheiro."
        : mode === "forgot"
          ? "Enviaremos um código para você criar uma nova senha."
          : "Faça login na sua conta para continuar cuidando da sua vida financeira.";
  return (
    <main className="login-screen">
      <img className="login-artwork" src="/login-artwork.svg" alt="" aria-hidden="true" />
      <section className="login-hero">
        <div className="login-brand">
          <span className="login-brand-mark"><svg viewBox="0 0 52 52" aria-hidden="true"><path d="M7 31.5 24 22v18L7 49V31.5Zm20-11L46 10v27L27 48V20.5ZM25 4 46 0v7L25 18V4Z" /></svg></span>
          <div><strong>Fluxary<span>.ia</span></strong><small>Sua vida financeira, <b>sob controle.</b></small></div>
        </div>
        <div className="login-spark login-spark-one">✦</div><div className="login-spark login-spark-two">✦</div>
        <img className="login-hero-mascot" src="/mascotes/login-jaguar.png" alt="Mascote Fluxary.ia piscando e fazendo sinal de positivo" />
        <div className="login-benefits">
          <div><Zap size={19} /><span>Organize<br />seus gastos</span></div>
          <div><TrendingUp size={19} /><span>Realize seus<br />objetivos</span></div>
          <div><Shield size={19} /><span>Cuide do seu<br />dinheiro com segurança</span></div>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-spark">✦</div>
          <h1>{title}</h1>
          <p>{description}</p>
          <span className="login-underline" />
          {!configured && !recovery && (
            <div className="setup-security auth-setup-notice">
              <ShieldCheck size={17} />
              <span>Preencha a URL e a chave pública do Supabase no arquivo .env e reinicie o app.</span>
            </div>
          )}
          {message && <div className="auth-feedback auth-feedback-success" role="status"><CheckCircle2 size={16} /><span>{message}</span></div>}
          {recovery && recoveryStep === "code" && !message && <div className="auth-feedback auth-feedback-success" role="status"><CheckCircle2 size={16} /><span>Enviamos um código de recuperação para seu e-mail.</span></div>}
          {error && <div className="auth-feedback auth-feedback-error" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
          <form className="auth-form" noValidate onSubmit={submit}>
            {isCodeVerification ? (
              <>
                {recovery ? (
                  <input type="hidden" name="email" value={recoveryEmail} />
                ) : (
                  <label className="auth-input-wrap"><UserRound className="auth-user-icon" size={17} /><input name="email" type="email" placeholder="Seu e-mail" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                )}
                <label className="auth-otp-label">
                  Código de verificação
                  <input
                    className="auth-otp-input"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={8}
                    pattern="[0-9]{6,8}"
                    required
                    aria-label="Código de verificação enviado por e-mail"
                  />
                </label>
              </>
            ) : recovery && recoveryStep === "password" ? (
              <>
                <label className="auth-input-wrap"><LockKeyhole size={17} /><input name="password" type={showPassword ? "text" : "password"} placeholder="Nova senha" minLength={8} required autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></label>
                <label className="auth-input-wrap"><LockKeyhole size={17} /><input name="password-confirm" type={showPassword ? "text" : "password"} placeholder="Confirme a nova senha" minLength={8} required autoComplete="new-password" /></label>
              </>
            ) : (
              <>
                {mode === "register" && <label className="auth-input-wrap"><UserRound className="auth-user-icon" size={17} /><input name="name" placeholder="Seu nome" autoComplete="name" required maxLength={80} /></label>}
                <label className="auth-input-wrap"><UserRound className="auth-user-icon" size={17} /><input name="email" type="email" placeholder="Seu e-mail" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                {mode !== "forgot" && <label className="auth-input-wrap"><LockKeyhole size={17} /><input name="password" type={showPassword ? "text" : "password"} placeholder="Sua senha" minLength={8} required autoComplete={mode === "register" ? "new-password" : "current-password"} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></label>}
                {mode === "register" && <label className="auth-input-wrap"><LockKeyhole size={17} /><input name="password-confirm" type={showPassword ? "text" : "password"} placeholder="Confirme sua senha" minLength={8} required autoComplete="new-password" /></label>}
                {mode === "login" && <div className="auth-inline-links"><label className="remember-me"><input type="checkbox" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} /> Lembrar de mim</label><button type="button" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Esqueceu sua senha?</button></div>}
              </>
            )}
            <button className="button-primary auth-submit" type="submit" disabled={busy || (!configured && !recovery)}>
              {busy ? "Aguarde..." : recovery && recoveryStep === "password" ? "Salvar nova senha" : isCodeVerification ? "Confirmar código" : mode === "register" ? "Criar conta" : mode === "forgot" ? "Enviar código de recuperação" : <>Entrar <ArrowRight size={17} /></>}
            </button>
          </form>
          {isCodeVerification && (
            <div className="auth-code-actions">
              <button type="button" onClick={() => void resendCode(recovery ? "recovery" : undefined)} disabled={busy}>Reenviar código</button>
              {recovery
                ? <button type="button" onClick={onRecoveryComplete}>Cancelar</button>
                : <button type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>Voltar ao login</button>}
            </div>
          )}
          {!recovery && !isCodeVerification && mode !== "forgot" && (
            <>
              <div className="auth-divider"><span>ou</span></div>
              <button className="google-signin" disabled={!configured || busy} onClick={() => void googleSignIn()}>
                <svg className="google-mark" viewBox="0 0 48 48" role="img" aria-label="Google">
                  <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4 6l6.5 5c3.8-3.5 6.1-8.6 6.1-14.7Z" />
                  <path fill="#34A853" d="M24 44c5.4 0 9.9-1.8 13.2-4.8l-6.5-5c-1.8 1.2-4 1.9-6.7 1.9-5.2 0-9.6-3.5-11.2-8.2l-6.7 5.2C9.4 39.5 16.2 44 24 44Z" />
                  <path fill="#FBBC05" d="M12.8 27.9a12 12 0 0 1 0-7.7l-6.7-5.2a20 20 0 0 0 0 18.1l6.7-5.2Z" />
                  <path fill="#EA4335" d="M24 12.1c2.9 0 5.5 1 7.5 3l5.8-5.8C33.9 6.1 29.4 4 24 4 16.2 4 9.4 8.5 6.1 15l6.7 5.2c1.6-4.7 6-8.1 11.2-8.1Z" />
                </svg>
                Entrar com Google
              </button>
            </>
          )}
          {!recovery && !isCodeVerification && (
            <div className="auth-register-prompt">
              {mode === "register" ? "Já tem uma conta?" : mode === "forgot" ? "Lembrou sua senha?" : "Não tem uma conta?"}
              <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>{mode === "register" || mode === "forgot" ? "Entrar" : "Cadastre-se"}</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
