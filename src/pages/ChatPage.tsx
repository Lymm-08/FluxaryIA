import { LoaderCircle, MessageSquare, Plus, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ChatMessage as ChatMessageView, MascotAvatar } from "../components/ChatMessage";
import {
  createChatConversation,
  deleteChatConversation,
  listChatConversations,
  loadChatMessages,
  sendChatMessage,
  type ChatConversation,
  type ChatMessage,
} from "../services/chat";

// Atalhos preenchem o mesmo campo e preservam o fluxo normal de envio.
const suggestedQuestions = [
  "Como estão meus gastos neste mês?",
  "Compare minhas receitas e despesas recentes.",
  "Como posso avançar nas minhas metas?",
];

export function ChatPage({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const historyRequestId = useRef(0);
  const sendingRef = useRef(false);

  // Histórico persistido e isolado pelo Supabase para a conta autenticada.
  const refreshConversations = useCallback(async () => {
    const saved = await listChatConversations();
    setConversations(saved);
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    listChatConversations()
      .then((saved) => {
        if (active) setConversations(saved);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar as conversas.");
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (messagesElement) messagesElement.scrollTop = messagesElement.scrollHeight;
  }, [messages, sending]);

  // Ações do histórico e do composer.
  async function openConversation(id: string) {
    if (sending || id === conversationId) return;
    const requestId = ++historyRequestId.current;
    setError("");
    setConversationId(id);
    setMessages([]);
    try {
      const loaded = await loadChatMessages(id);
      if (requestId === historyRequestId.current) setMessages(loaded);
    } catch (reason) {
      if (requestId === historyRequestId.current) {
        setError(reason instanceof Error ? reason.message : "Não foi possível abrir esta conversa.");
      }
    }
  }

  function startNewConversation() {
    if (sending) return;
    historyRequestId.current += 1;
    setConversationId(null);
    setMessages([]);
    setDraft("");
    setError("");
  }

  async function removeConversation(id: string) {
    if (sending || !window.confirm("Excluir esta conversa? Essa ação não pode ser desfeita.")) return;
    setError("");
    try {
      await deleteChatConversation(id);
      setConversations((current) => current.filter((item) => item.id !== id));
      if (conversationId === id) {
        historyRequestId.current += 1;
        setConversationId(null);
        setMessages([]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir a conversa.");
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sendingRef.current) return;
    if (message.length > 2_000) {
      setError("Sua mensagem deve ter no máximo 2.000 caracteres.");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setError("");
    try {
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const created = await createChatConversation(userId, message);
        activeConversationId = created.id;
        setConversationId(created.id);
        setConversations((current) => [created, ...current]);
      }
      const reply = await sendChatMessage(activeConversationId, message);
      const now = new Date().toISOString();
      setMessages((current) => [
        ...current,
        {
          id: `user-${now}`,
          conversation_id: activeConversationId,
          role: "user",
          content: message,
          created_at: now,
        },
        {
          id: `assistant-${now}`,
          conversation_id: activeConversationId,
          role: "assistant",
          content: reply,
          created_at: now,
        },
      ]);
      setDraft("");
      try {
        await refreshConversations();
      } catch {
        setError("A resposta foi enviada, mas não foi possível atualizar a lista de conversas.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível responder agora. Tente novamente.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <section className="chat-page">
      <div className="chat-layout">
        <aside className="panel chat-history">
          <div className="chat-history-heading">
            <div><span className="eyebrow">SEU ESPAÇO</span><h2>Conversas</h2></div>
            <span className="chat-history-count">{conversations.length}</span>
          </div>
          {loadingHistory ? (
            <p className="chat-history-state" role="status">Carregando conversas...</p>
          ) : conversations.length ? (
            <ul className="chat-conversation-list">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <div className={`chat-conversation-row ${conversationId === conversation.id ? "chat-conversation-active" : ""}`}>
                    <button
                      className="chat-conversation"
                      type="button"
                      onClick={() => void openConversation(conversation.id)}
                      disabled={sending}
                    >
                      <MessageSquare size={15} />
                      <span>{conversation.title}</span>
                    </button>
                  <button
                    aria-label={`Excluir conversa ${conversation.title}`}
                    className="chat-delete-button"
                    type="button"
                    onClick={() => void removeConversation(conversation.id)}
                    disabled={sending}
                  >
                    <Trash2 size={14} />
                  </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="chat-history-state"><MessageSquare size={17} /><span>Suas conversas aparecerão aqui.</span></div>
          )}
        </aside>

        <section className="panel chat-window" aria-label="Conversa com o assistente financeiro">
          <header className="chat-conversation-header">
            <div className="chat-assistant-profile">
              <MascotAvatar />
              <div className="chat-assistant-details">
                <h1>Assistente Fluxary</h1>
                <span><i aria-hidden="true" /> Disponível para conversar</span>
              </div>
            </div>
            <button className="chat-new-button" type="button" onClick={startNewConversation} disabled={sending}>
              <Plus size={16} /><span>Nova conversa</span>
            </button>
          </header>

          <div className="chat-messages" ref={messagesRef} role="log" aria-live="polite">
            {messages.length === 0 && !sending ? (
              <div className="chat-welcome">
                <MascotAvatar welcome />
                <span className="chat-welcome-kicker">SEU ASSISTENTE FINANCEIRO PESSOAL</span>
                <h2>Olá! Como posso ajudar com suas finanças hoje?</h2>
                <p>Estou aqui para ajudar você a entender seus gastos, planejar metas e tomar decisões com mais confiança.</p>
                <div className="chat-suggestions">
                  {suggestedQuestions.map((question) => (
                    <button key={question} type="button" onClick={() => setDraft(question)}>
                      <span>{question}</span><span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => <ChatMessageView key={message.id} message={message} />)
            )}
            {sending && (
              <div className="chat-thinking" role="status">
                <MascotAvatar />
                <div className="chat-thinking-bubble"><span /><span /><span /></div>
                <span className="visually-hidden">Assistente Fluxary está escrevendo</span>
              </div>
            )}
          </div>

          {error && <p className="chat-error" role="alert">{error}</p>}
          <form className="chat-composer" onSubmit={(event) => void submitMessage(event)}>
            <label className="visually-hidden" htmlFor="chat-message">Digite sua pergunta</label>
            <textarea
              id="chat-message"
              aria-describedby="chat-composer-hint"
              maxLength={2_000}
              placeholder="Pergunte sobre suas finanças..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={sending}
              rows={2}
            />
            <div className="chat-composer-footer">
              <span id="chat-composer-hint">Enter para enviar · Shift + Enter para nova linha</span>
              <button className="button-primary chat-send-button" type="submit" disabled={sending || !draft.trim()} aria-label="Enviar mensagem">
                {sending ? <LoaderCircle size={16} className="chat-spinner" /> : <Send size={15} />}
                <span>Enviar</span>
              </button>
            </div>
          </form>
          <p className="chat-privacy-note">
            Seus dados são consultados com segurança e usados somente para contextualizar a resposta.
          </p>
        </section>
      </div>
    </section>
  );
}