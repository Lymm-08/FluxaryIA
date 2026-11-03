import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { setRememberSessionPreference } from "../lib/auth-storage";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  passwordRecovery: boolean;
  recoveryEmail: string;
  recoveryStep: "code" | "password";
  signIn: (email: string, password: string, rememberSession: boolean) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, token: string, type: "signup" | "recovery") => Promise<void>;
  resendEmailCode: (email: string, type: "signup" | "recovery") => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  finishPasswordRecovery: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Mantém uma sessão autenticada compartilhada entre login e área financeira.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryStep, setRecoveryStep] = useState<"code" | "password">("code");

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session: Session | null) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
        setRecoveryStep("password");
      }
      if (event === "SIGNED_OUT") {
        setPasswordRecovery(false);
        setRecoveryEmail("");
        setRecoveryStep("code");
      }
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error("Não foi possível restaurar a sessão Supabase.", error);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    configured: supabaseConfigured,
    loading,
    user,
    passwordRecovery,
    recoveryEmail,
    recoveryStep,
    async signIn(email, password, rememberSession) {
      if (!supabase) throw new Error("Configure a URL e a chave pública do Supabase para habilitar o login.");
      setRememberSessionPreference(rememberSession);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signUp(name, email, password) {
      if (!supabase) throw new Error("Configure a URL e a chave pública do Supabase para habilitar o cadastro.");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      return Boolean(data.session);
    },
    async signInWithGoogle() {
      if (!supabase) throw new Error("Configure o Supabase para habilitar o login com Google.");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    },
    async sendPasswordReset(email) {
      if (!supabase) throw new Error("Configure o Supabase para recuperar a senha.");
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) throw error;
      setRecoveryEmail(email);
      setRecoveryStep("code");
      setPasswordRecovery(true);
    },
    async verifyEmailCode(email, token, type) {
      if (!supabase) throw new Error("Configure o Supabase para validar o código.");
      const { data, error } = await supabase.auth.verifyOtp({ email, token: token.trim(), type });
      if (error) throw error;
      if (!data.session) throw new Error("O código foi validado, mas não foi possível iniciar sua sessão. Tente novamente.");
      if (type === "recovery") {
        setRecoveryEmail(email);
        setRecoveryStep("password");
        setPasswordRecovery(true);
      }
    },
    async resendEmailCode(email, type) {
      if (!supabase) throw new Error("Configure o Supabase para reenviar o código.");
      const { error } = type === "signup"
        ? await supabase.auth.resend({ type: "signup", email })
        : await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) throw error;
    },
    async updatePassword(password) {
      if (!supabase) throw new Error("Configure o Supabase para trocar a senha.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    async signOut() {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    finishPasswordRecovery() {
      setPasswordRecovery(false);
      setRecoveryEmail("");
      setRecoveryStep("code");
    },
  }), [loading, passwordRecovery, recoveryEmail, recoveryStep, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider.");
  return context;
}
