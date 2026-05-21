export function LoadingSpinner({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
      <span className="text-sm text-muted">{text}</span>
    </div>
  );
}
