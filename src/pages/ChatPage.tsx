import { Bot, LoaderCircle, MessageSquare, Plus, Send, Sparkles, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  createChatConversation,
  deleteChatConversation,
  listChatConversations,
  loadChatMessages,
  sendChatMessage,
  type ChatConversation,
  type ChatMessage,
} from "../services/chat";

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
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

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
      <header className="chat-page-heading">
        <div>
          <span className="eyebrow">ASSISTENTE FINANCEIRO</span>
          <h1>Chat Fluxary</h1>
          <p>Converse sobre seu dinheiro com contexto dos seus dados financeiros.</p>
        </div>
        <span className="chat-heading-icon"><Sparkles size={18} /></span>
      </header>

      <div className="chat-layout">
        <aside className="panel chat-history">
          <div className="chat-history-heading">
            <h2>Conversas</h2>
            <button className="button-primary chat-new-button" type="button" onClick={startNewConversation} disabled={sending}>
              <Plus size={15} /> Nova
            </button>
          </div>
          {loadingHistory ? (
            <p className="chat-history-state">Carregando conversas...</p>
          ) : conversations.length ? (
            <ul className="chat-conversation-list">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    className={`chat-conversation ${conversationId === conversation.id ? "chat-conversation-active" : ""}`}
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
                </li>
              ))}
            </ul>
          ) : (
            <p className="chat-history-state">Suas conversas aparecerão aqui.</p>
          )}
        </aside>

        <section className="panel chat-window" aria-label="Conversa com o assistente financeiro">
          <div className="chat-messages" ref={messagesRef} role="log" aria-live="polite">
            {messages.length === 0 && !sending ? (
              <div className="chat-welcome">
                <span className="chat-welcome-icon"><Bot size={22} /></span>
                <h2>Como posso ajudar com suas finanças?</h2>
                <p>Posso analisar suas movimentações, comparar períodos e ajudar com metas e orçamento.</p>
                <div className="chat-suggestions">
                  {suggestedQuestions.map((question) => (
                    <button key={question} type="button" onClick={() => setDraft(question)}>{question}</button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <article className={`chat-message chat-message-${message.role}`} key={message.id}>
                  <span className="chat-message-avatar" aria-hidden="true">
                    {message.role === "assistant" ? <Bot size={15} /> : <UserRound size={15} />}
                  </span>
                  <div className="chat-message-content">
                    <strong>{message.role === "assistant" ? "Fluxary" : "Você"}</strong>
                    <p>{message.content}</p>
                  </div>
                </article>
              ))
            )}
            {sending && (
              <div className="chat-thinking" role="status"><LoaderCircle size={16} className="chat-spinner" /> Analisando sua pergunta...</div>
            )}
          </div>

          {error && <p className="chat-error" role="alert">{error}</p>}
          <form className="chat-composer" onSubmit={(event) => void submitMessage(event)}>
            <label className="visually-hidden" htmlFor="chat-message">Digite sua pergunta</label>
            <textarea
              id="chat-message"
              maxLength={2_000}
              placeholder="Pergunte sobre suas finanças..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={sending}
              rows={2}
            />
            <div className="chat-composer-footer">
              <span>Enter para enviar · Shift + Enter para nova linha</span>
              <button className="button-primary chat-send-button" type="submit" disabled={sending || !draft.trim()} aria-label="Enviar mensagem">
                {sending ? <LoaderCircle size={16} className="chat-spinner" /> : <Send size={15} />}
                <span>Enviar</span>
              </button>
            </div>
          </form>
          <p className="chat-privacy-note">
            Suas movimentações são consultadas com sua sessão e políticas RLS; um resumo é enviado à OpenAI para gerar a resposta.
          </p>
        </section>
      </div>
    </section>
  );
}