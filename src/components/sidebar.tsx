"use client";

import { type Conversation } from "@/lib/db";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: SidebarProps) {
  return (
    <div className="w-64 border-r border-border flex flex-col h-full bg-surface">
      <div className="p-4">
        <button
          onClick={onNew}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors ${
              activeId === conv.id
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-border/50"
            }`}
            onClick={() => onSelect(conv.id)}
          >
            <span className="flex-1 truncate">{conv.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 ml-2 transition-opacity"
            >
              ×
            </button>
          </div>
        ))}

        {conversations.length === 0 && (
          <p className="text-sm text-muted text-center py-8">
            No conversations yet
          </p>
        )}
      </div>
    </div>
  );
}
