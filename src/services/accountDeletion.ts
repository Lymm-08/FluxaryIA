import { supabase } from "../lib/supabase";

type AccountDeletionResponse = {
  status?: "email_sent" | "valid" | "expired" | "invalid" | "used" | "deleted";
  error?: string;
};

async function callAccountDeletion(
  payload: { action: "request" } | { action: "validate" | "confirm"; token: string },
  authenticated: boolean,
): Promise<AccountDeletionResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authenticated) {
    if (!supabase) throw new Error("O serviço da conta não está configurado.");
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session?.access_token) throw new Error("Entre novamente na sua conta para continuar.");
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch("/api/delete_account", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  let result: AccountDeletionResponse;
  try {
    result = await response.json() as AccountDeletionResponse;
  } catch {
    throw new Error("Não foi possível interpretar a resposta do servidor.");
  }
  if (!response.ok) throw new Error(result.error || "Não foi possível concluir a solicitação.");
  return result;
}

export async function requestAccountDeletion(): Promise<void> {
  const result = await callAccountDeletion({ action: "request" }, true);
  if (result.status !== "email_sent") throw new Error("Não foi possível enviar o e-mail de confirmação.");
}

export async function validateAccountDeletionToken(
  token: string,
): Promise<"valid" | "expired" | "invalid" | "used"> {
  const result = await callAccountDeletion({ action: "validate", token }, false);
  if (
    result.status !== "valid"
    && result.status !== "expired"
    && result.status !== "invalid"
    && result.status !== "used"
  ) {
    throw new Error("Não foi possível validar o link de confirmação.");
  }
  return result.status;
}

export async function confirmAccountDeletion(token: string): Promise<void> {
  const result = await callAccountDeletion({ action: "confirm", token }, false);
  if (result.status !== "deleted") throw new Error("Não foi possível excluir a conta.");
}
