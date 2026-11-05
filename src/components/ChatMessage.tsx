import type { ReactNode } from "react";
import type { ChatMessage as ChatMessageData } from "../services/chat";

const inlinePattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
const headingPattern = /^#{1,3}\s+(.+)$/;
const listPattern = /^\s*((?:[-*•])|(?:\d+[.)]))\s+(.+)$/;

// Converte apenas marcações inline conhecidas em nós React, sem interpretar HTML.
function renderInline(text: string): ReactNode[] {
  return text.split(inlinePattern).filter(Boolean).map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

// Mantém títulos, listas e parágrafos da resposta sem dependência de renderizador HTML.
function renderFormattedText(text: string) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const heading = line.match(headingPattern);
    if (heading) {
      blocks.push(<h3 key={`heading-${index}`}>{renderInline(heading[1])}</h3>);
      index += 1;
      continue;
    }

    const listItem = line.match(listPattern);
    if (listItem) {
      const ordered = /^\d/.test(listItem[1]);
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const nextItem = lines[index].trim().match(listPattern);
        if (!nextItem || /^\d/.test(nextItem[1]) !== ordered) break;
        items.push(<li key={`item-${index}`}>{renderInline(nextItem[2])}</li>);
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={`list-${index}`}>{items}</List>);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || headingPattern.test(next) || listPattern.test(next)) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{renderInline(paragraph.join("\n"))}</p>);
  }

  return blocks;
}

// Usa os arquivos oficiais do mascote sem alterar a imagem de origem.
export function MascotAvatar({ welcome = false }: { welcome?: boolean }) {
  return (
    <span className={`chat-mascot-avatar${welcome ? " chat-mascot-avatar-welcome" : ""}`}>
      <img
        src={welcome ? "/mascotes/boas-vindas.png" : "/mascotes/neutra.png"}
        alt={welcome ? "Mascote Fluxary dando boas-vindas" : "Mascote Fluxary"}
      />
    </span>
  );
}

// Apresenta a mensagem persistida com o avatar e o alinhamento do seu autor.
export function ChatMessage({ message }: { message: ChatMessageData }) {
  const assistant = message.role === "assistant";

  return (
    <article className={`chat-message chat-message-${message.role}`}>
      {assistant ? (
        <MascotAvatar />
      ) : (
        <span className="chat-message-avatar chat-user-avatar" aria-hidden="true">Você</span>
      )}
      <div className="chat-message-content">
        <div className="chat-message-author">{assistant ? "Felix" : "Você"}</div>
        <div className="chat-message-text">
          {assistant ? renderFormattedText(message.content) : <p>{message.content}</p>}
        </div>
      </div>
    </article>
  );
}
