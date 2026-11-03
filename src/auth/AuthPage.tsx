import { useLayoutEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Shield, TrendingUp, UserRound, Zap } from "lucide-react";

type AuthPageProps = {
  configured: boolean;
  recovery: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (name: string, email: string, password: string) => Promise<boolean>;
  onGoogleSignIn: () => Promise<void>;
  onSendPasswordReset: (email: string) => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
  onRecoveryComplete: () => void;
};

type AuthMode = "login" | "register" | "forgot";

// Login, cadastro e recuperação de senha da conta Supabase.
export function AuthPage({
  configured, recovery, onSignIn, onSignUp, onGoogleSignIn, onSendPasswordReset, onUpdatePassword, onRecoveryComplete,
}: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = "light";
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const formEmail = String(form.get("email") ?? email).trim();
    setEmail(formEmail);
    try {
      if (recovery) {
        const password = String(form.get("password") ?? "");
        if (password !== String(form.get("password-confirm") ?? "")) throw new Error("As senhas não conferem.");
        await onUpdatePassword(password);
        onRecoveryComplete();
        return;
      }
      if (mode === "forgot") {
        await onSendPasswordReset(formEmail);
        setMessage("Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha.");
      } else if (mode === "register") {
        const password = String(form.get("password") ?? "");
        if (password !== String(form.get("password-confirm") ?? "")) throw new Error("As senhas não conferem.");
        const hasSession = await onSignUp(String(form.get("name") ?? "").trim(), formEmail, password);
        if (!hasSession) setMessage("Cadastro recebido. Confira seu e-mail para confirmar a conta e depois entre.");
      } else {
        await onSignIn(formEmail, String(form.get("password") ?? ""));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível concluir a solicitação.");
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

  const title = recovery ? "Crie uma nova senha" : mode === "register" ? "Crie sua conta" : mode === "forgot" ? "Recuperar senha" : "Bem-vinda de volta";
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
          <p>{recovery ? "Escolha uma senha segura para continuar cuidando da sua vida financeira." : mode === "register" ? "Crie sua conta e comece a cuidar melhor do seu dinheiro." : mode === "forgot" ? "Enviaremos um link para você criar uma nova senha." : "Faça login na sua conta para continuar cuidando da sua vida financeira."}</p>
          <span className="login-underline" />
          {!configured && !recovery && (
            <div className="setup-security auth-setup-notice">
              <ShieldCheck size={17} />
              <span>Preencha a URL e a chave pública do Supabase no arquivo .env e reinicie o app.</span>
            </div>
          )}
          {message && <div className="auth-success" role="status">{message}</div>}
          {error && <div className="auth-message" role="alert">{error}</div>}
          <form className="auth-form" onSubmit={submit}>
            {recovery ? (
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
                {mode === "login" && <div className="auth-inline-links"><label className="remember-me"><input type="checkbox" /> Lembrar de mim</label><button type="button" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Esqueceu sua senha?</button></div>}
              </>
            )}
            <button className="button-primary auth-submit" type="submit" disabled={busy || (!configured && !recovery)}>
              {busy ? "Aguarde..." : recovery ? "Salvar nova senha" : mode === "register" ? "Criar conta" : mode === "forgot" ? "Enviar link de recuperação" : <>Entrar <ArrowRight size={17} /></>}
            </button>
          </form>
          {!recovery && mode !== "forgot" && (
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
          {!recovery && (
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
