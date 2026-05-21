interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
}

export function ChatInput({
  input,
  setInput,
  onSend,
  isLoading,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t border-border px-6 py-4">
      <div className="flex items-end gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your company..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={isLoading || !input.trim()}
          className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
