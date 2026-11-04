import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatMessage } from "../src/components/ChatMessage";
import { ChatPage } from "../src/pages/ChatPage";
import type { ChatConversation, ChatMessage as ChatMessageData } from "../src/services/chat";

const chatServices = vi.hoisted(() => ({
  listChatConversations: vi.fn(),
  loadChatMessages: vi.fn(),
  createChatConversation: vi.fn(),
  deleteChatConversation: vi.fn(),
  sendChatMessage: vi.fn(),
  updateChatConversationTitle: vi.fn(),
}));

vi.mock("../src/services/chat", () => ({
  ...chatServices,
}));

const conversation: ChatConversation = {
  id: "conversation-1",
  title: "Meu orçamento",
  created_at: "2026-11-04T10:00:00.000Z",
  updated_at: "2026-11-04T10:00:00.000Z",
};

const previousMessage: ChatMessageData = {
  id: "message-1",
  conversation_id: conversation.id,
  role: "assistant",
  content: "## Resumo\nVocê gastou **R$ 200**.\n- Mercado\n- Transporte",
  created_at: "2026-11-04T10:01:00.000Z",
};

describe("Chat Fluxary", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    chatServices.listChatConversations.mockResolvedValue([conversation]);
    chatServices.loadChatMessages.mockResolvedValue([previousMessage]);
    chatServices.createChatConversation.mockResolvedValue(conversation);
    chatServices.deleteChatConversation.mockResolvedValue(undefined);
    chatServices.sendChatMessage.mockResolvedValue("Resposta do assistente.");
    chatServices.updateChatConversationTitle.mockImplementation(async (id: string, title: string) => ({
      ...conversation,
      id,
      title,
      updated_at: "2026-11-04T10:02:00.000Z",
    }));
  });

  it("uses the official mascot and formats structured assistant messages", () => {
    render(<ChatMessage message={previousMessage} />);

    expect(screen.getByRole("img", { name: "Mascote Fluxary" }).getAttribute("src")).toBe("/mascotes/neutra.png");
    expect(screen.getByRole("heading", { name: "Resumo" })).toBeTruthy();
    expect(screen.getByText("R$ 200").tagName).toBe("STRONG");
    expect(screen.getByText("Mercado").closest("li")).toBeTruthy();
    expect(screen.getByText("Transporte").closest("li")).toBeTruthy();
  });

  it("opens persisted conversations and sends a message with Enter", async () => {
    const user = userEvent.setup();
    render(<ChatPage userId="user-1" />);

    const previousConversation = await screen.findByRole("button", { name: "Meu orçamento" });
    await user.click(previousConversation);
    expect(await screen.findByText("R$ 200")).toBeTruthy();

    const composer = screen.getByRole("textbox", { name: "Digite sua pergunta" });
    await user.type(composer, "Como economizar?");
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", shiftKey: true });
    expect(chatServices.sendChatMessage).not.toHaveBeenCalled();
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(chatServices.sendChatMessage).toHaveBeenCalledWith(conversation.id, "Como economizar?");
    });
    expect(await screen.findByText("Resposta do assistente.")).toBeTruthy();
  });

  it("shows the user's message immediately while the assistant is responding", async () => {
    const user = userEvent.setup();
    let resolveReply: (reply: string) => void = () => undefined;
    chatServices.sendChatMessage.mockImplementationOnce(() => new Promise<string>((resolve) => {
      resolveReply = resolve;
    }));
    render(<ChatPage userId="user-1" />);

    await user.click(await screen.findByRole("button", { name: "Meu orçamento" }));
    await screen.findByText("R$ 200");
    const composer = screen.getByRole("textbox", { name: "Digite sua pergunta" });
    await user.type(composer, "Qual meu saldo?");
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });

    expect(await screen.findByText("Qual meu saldo?")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Assistente Fluxary está escrevendo");
    expect((composer as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByText("Resposta do assistente.")).toBeNull();

    resolveReply("Seu saldo está atualizado.");
    expect(await screen.findByText("Seu saldo está atualizado.")).toBeTruthy();
  });

  it("allows renaming a conversation and saves the updated title", async () => {
    const user = userEvent.setup();
    render(<ChatPage userId="user-1" />);

    await user.click(await screen.findByRole("button", { name: "Editar nome da conversa Meu orçamento" }));
    const titleInput = screen.getByRole("textbox", { name: "Editar nome da conversa Meu orçamento" });
    await user.clear(titleInput);
    await user.type(titleInput, "Planejamento anual");
    await user.click(screen.getByRole("button", { name: "Salvar nome da conversa" }));

    await waitFor(() => {
      expect(chatServices.updateChatConversationTitle).toHaveBeenCalledWith(
        conversation.id,
        "Planejamento anual",
      );
    });
    expect(await screen.findByRole("button", { name: "Planejamento anual" })).toBeTruthy();
  });

  it("shows loading failures instead of hiding them", async () => {
    chatServices.listChatConversations.mockRejectedValueOnce(new Error("Falha ao carregar o histórico."));
    render(<ChatPage userId="user-1" />);

    expect((await screen.findByRole("alert")).textContent).toContain("Falha ao carregar o histórico.");
  });

  it("uses the Fluxary confirmation dialog before deleting a conversation", async () => {
    const user = userEvent.setup();
    render(<ChatPage userId="user-1" />);

    await user.click(await screen.findByRole("button", { name: "Excluir conversa Meu orçamento" }));

    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Essa ação não pode ser desfeita. As mensagens desta conversa também serão removidas.")).toBeTruthy();
    expect(chatServices.deleteChatConversation).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(chatServices.deleteChatConversation).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Excluir conversa Meu orçamento" }));
    await user.click(screen.getByRole("button", { name: "Excluir conversa", exact: true }));

    await waitFor(() => {
      expect(chatServices.deleteChatConversation).toHaveBeenCalledWith(conversation.id);
    });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Excluir conversa Meu orçamento" })).toBeNull());
  });

  it("preserves question suggestions and offers a new conversation", async () => {
    const user = userEvent.setup();
    render(<ChatPage userId="user-1" />);

    const suggestedQuestion = await screen.findByRole("button", { name: /Como estão meus gastos neste mês/ });
    await user.click(suggestedQuestion);
    expect((screen.getByRole("textbox", { name: "Digite sua pergunta" }) as HTMLTextAreaElement).value)
      .toBe("Como estão meus gastos neste mês?");

    await user.click(screen.getByRole("button", { name: /Nova conversa/ }));
    expect(screen.getByRole("heading", { name: "Olá! Como posso ajudar com suas finanças hoje?" })).toBeTruthy();
  });
});
