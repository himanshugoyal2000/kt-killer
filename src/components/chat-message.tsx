import type { UIMessage } from "ai";

// In AI SDK v6, messages use `parts` instead of a single `content` string.
// Each part has a `type` — for now we only care about "text" parts.
// Later phases will use other part types (tool calls, images, etc.)

interface ChatMessageProps {
  message: UIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  const textContent = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

  if (!textContent) return null;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-white"
            : "bg-surface border border-border text-foreground"
        }`}
      >
        {textContent}
      </div>
    </div>
  );
}
