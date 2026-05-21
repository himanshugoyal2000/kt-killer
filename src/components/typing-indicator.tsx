export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-surface border border-border rounded-2xl px-4 py-3 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-muted animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
