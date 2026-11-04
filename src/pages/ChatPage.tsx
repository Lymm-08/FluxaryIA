import { Check, LoaderCircle, MessageSquare, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ChatMessage as ChatMessageView, MascotAvatar } from "../components/ChatMessage";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  createChatConversation,
  deleteChatConversation,
  listChatConversations,
  loadChatMessages,
  sendChatMessage,
  updateChatConversationTitle,
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
  const [conversationToDelete, setConversationToDelete] = useState<ChatConversation | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [conversationTitleDraft, setConversationTitleDraft] = useState("");
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

  function removeConversation(conversation: ChatConversation) {
    if (!sending) setConversationToDelete(conversation);
  }

  function beginEditConversation(conversation: ChatConversation) {
    setEditingConversationId(conversation.id);
    setConversationTitleDraft(conversation.title);
    setError("");
  }

  function cancelEditConversation() {
    setEditingConversationId(null);
    setConversationTitleDraft("");
  }

  async function saveConversationTitle(event: FormEvent<HTMLFormElement>, conversation: ChatConversation) {
    event.preventDefault();
    const title = conversationTitleDraft.trim();
    if (!title) {
      setError("O nome da conversa não pode ficar vazio.");
      return;
    }
    if (Array.from(title).length > 80) {
      setError("O nome da conversa deve ter no máximo 80 caracteres.");
      return;
    }
    setError("");
    try {
      const updated = await updateChatConversationTitle(conversation.id, title);
      setConversations((current) => [updated, ...current.filter((item) => item.id !== updated.id)]
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at)));
      cancelEditConversation();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível renomear a conversa.");
    }
  }

  async function confirmRemoveConversation() {
    const conversation = conversationToDelete;
    if (!conversation || sending) return;
    setConversationToDelete(null);
    setError("");
    try {
      await deleteChatConversation(conversation.id);
      setConversations((current) => current.filter((item) => item.id !== conversation.id));
      if (conversationId === conversation.id) {
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
    const now = new Date().toISOString();
    const optimisticConversationId = conversationId ?? `pending-${Date.now()}`;
    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}-${current.length}`,
        conversation_id: optimisticConversationId,
        role: "user",
        content: message,
        created_at: now,
      },
    ]);
    setDraft("");
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
      if (!activeConversationId) throw new Error("Não foi possível iniciar esta conversa.");
      const reply = await sendChatMessage(activeConversationId, message);
      setMessages((current) => [
        ...current,
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
                    {editingConversationId === conversation.id ? (
                      <form
                        className="chat-conversation-edit-form"
                        onSubmit={(event) => void saveConversationTitle(event, conversation)}
                      >
                        <label className="visually-hidden" htmlFor={`conversation-title-${conversation.id}`}>
                          Editar nome da conversa
                        </label>
                        <input
                          id={`conversation-title-${conversation.id}`}
                          aria-label={`Editar nome da conversa ${conversation.title}`}
                          maxLength={80}
                          autoFocus
                          value={conversationTitleDraft}
                          onChange={(event) => setConversationTitleDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") cancelEditConversation();
                          }}
                        />
                        <button className="chat-edit-action" type="submit" aria-label="Salvar nome da conversa">
                          <Check size={14} />
                        </button>
                        <button className="chat-edit-action" type="button" onClick={cancelEditConversation} aria-label="Cancelar edição do nome">
                          <X size={14} />
                        </button>
                      </form>
                    ) : (
                      <>
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
                          aria-label={`Editar nome da conversa ${conversation.title}`}
                          className="chat-edit-button"
                          type="button"
                          onClick={() => beginEditConversation(conversation)}
                          disabled={sending}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          aria-label={`Excluir conversa ${conversation.title}`}
                          className="chat-delete-button"
                          type="button"
                          onClick={() => removeConversation(conversation)}
                          disabled={sending}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
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
      {conversationToDelete && (
        <ConfirmDialog
          title="Excluir conversa?"
          message="Essa ação não pode ser desfeita. As mensagens desta conversa também serão removidas."
          confirmLabel="Excluir conversa"
          danger
          onConfirm={() => void confirmRemoveConversation()}
          onCancel={() => setConversationToDelete(null)}
        />
      )}
    </section>
  );
}