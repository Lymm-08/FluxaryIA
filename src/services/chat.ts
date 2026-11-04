import { supabase } from "../lib/supabase";

export type ChatConversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function getClient() {
  if (!supabase) throw new Error("O serviço de conversas não está configurado.");
  return supabase;
}

export async function listChatConversations(): Promise<ChatConversation[]> {
  const { data, error } = await getClient()
    .from("ai_conversations")
    .select("id,title,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function loadChatMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await getClient()
    .from("ai_messages")
    .select("id,conversation_id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.reverse();
}

export async function createChatConversation(userId: string, title: string): Promise<ChatConversation> {
  const { data, error } = await getClient()
    .from("ai_conversations")
    .insert({ user_id: userId, title: Array.from(title).slice(0, 80).join("") })
    .select("id,title,created_at,updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function updateChatConversationTitle(
  conversationId: string,
  title: string,
): Promise<ChatConversation> {
  const { data, error } = await getClient()
    .from("ai_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .select("id,title,created_at,updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteChatConversation(conversationId: string): Promise<void> {
  const { error } = await getClient()
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId);
  if (error) throw error;
}

export async function sendChatMessage(conversationId: string, message: string): Promise<string> {
  const client = getClient();
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente para continuar.");

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ conversation_id: conversationId, message }),
  });
  let result: { reply?: string; error?: string };
  try {
    result = await response.json() as { reply?: string; error?: string };
  } catch {
    throw new Error("Não foi possível interpretar a resposta do assistente.");
  }
  if (!response.ok) throw new Error(result.error || "Não foi possível enviar sua mensagem.");
  if (typeof result.reply !== "string" || !result.reply.trim()) {
    throw new Error("O assistente retornou uma resposta inválida.");
  }
  return result.reply;
}