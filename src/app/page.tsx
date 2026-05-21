"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { SignOutButton } from "@/components/sign-out-button";
import { Sidebar } from "@/components/sidebar";
import { TypingIndicator } from "@/components/typing-indicator";
import { LoadingSpinner } from "@/components/loading-spinner";
import { createClient } from "@/lib/supabase/client";
import {
  getConversations,
  getMessages,
  createConversation,
  saveMessage,
  deleteConversation,
  type Conversation,
} from "@/lib/db";
import type { UIMessage } from "ai";

export default function Home() {
  const supabase = createClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Tracks whether we've already saved the assistant response for the current exchange.
  // Without this, the onFinish callback could save duplicate messages.
  const savedAssistantRef = useRef(false);

  const { messages, sendMessage, setMessages, status, error } = useChat({
    // onFinish is called when the AI finishes streaming its response.
    // In v6, it receives an options object: { message, messages, isAbort, ... }
    // This is where we save the assistant's message to the database.
    onFinish: async ({ message }) => {
      if (!activeConversationId || savedAssistantRef.current) return;
      savedAssistantRef.current = true;

      const text = (message.parts ?? [])
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");

      if (text) {
        await saveMessage(supabase, activeConversationId, "assistant", text);
      }
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Load user and conversations on mount
  useEffect(() => {
    async function init() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const convs = await getConversations(supabase);
        setConversations(convs);
      } finally {
        setInitializing(false);
      }
    }
    init();
  }, []);

  // Load messages when switching conversations
  const loadConversation = useCallback(
    async (conversationId: string) => {
      setActiveConversationId(conversationId);
      setLoadingConversation(true);
      const msgs = await getMessages(supabase, conversationId);

      const uiMessages: UIMessage[] = msgs.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        parts: [{ type: "text" as const, text: msg.content }],
      }));
      setMessages(uiMessages);
      setLoadingConversation(false);
    },
    [supabase, setMessages]
  );

  const handleNew = () => {
    setActiveConversationId(null);
    setMessages([]);
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(supabase, id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      handleNew();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !userId) return;

    const text = input;
    setInput("");
    savedAssistantRef.current = false;

    let conversationId = activeConversationId;

    // If no active conversation, create one.
    // We must await this because we need the conversation ID before saving messages.
    if (!conversationId) {
      const title =
        text.length > 50 ? text.substring(0, 50) + "..." : text;
      const conv = await createConversation(supabase, userId, title);
      conversationId = conv.id;
      setActiveConversationId(conversationId);
      setConversations((prev) => [conv, ...prev]);
    }

    // Send to the AI immediately — user sees their message appear on screen right away.
    // Save to DB in the background — no need to block the UI for a write.
    sendMessage({ text });
    saveMessage(supabase, conversationId, "user", text);
  };

  return (
    <div className="flex h-full">
      {/* Sidebar with conversation history */}
      <Sidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={loadConversation}
        onNew={handleNew}
        onDelete={handleDelete}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h1 className="text-lg font-semibold">KT-Killer</h1>
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-sm text-muted hover:text-foreground transition-colors">
              Admin
            </a>
            <SignOutButton />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {initializing ? (
            <LoadingSpinner text="Loading..." />
          ) : loadingConversation ? (
            <LoadingSpinner text="Loading conversation..." />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h2 className="text-2xl font-semibold mb-2">
                What do you want to know?
              </h2>
              <p className="text-muted max-w-md">
                Ask anything about your company — architecture, processes,
                runbooks, onboarding, or debugging help.
              </p>
            </div>
          ) : null}

          {!loadingConversation &&
            messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

          {status === "submitted" && <TypingIndicator />}

          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
              Something went wrong: {error.message}
            </div>
          )}
        </div>

        <ChatInput
          input={input}
          setInput={setInput}
          onSend={handleSend}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
