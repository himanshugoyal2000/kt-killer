import { SupabaseClient } from "@supabase/supabase-js";

// All database operations go through this file.
// Every function takes a Supabase client as the first argument.
// Why? Because the client is different on the browser vs server (remember the two clients).
// By passing it in, the same DB logic works in both contexts.

export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export async function getConversations(supabase: SupabaseClient) {
  // RLS automatically filters to only the current user's conversations.
  // We don't need a WHERE user_id = ? clause — the policy handles it.
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data as Conversation[];
}

export async function getMessages(
  supabase: SupabaseClient,
  conversationId: string
) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Message[];
}

export async function createConversation(
  supabase: SupabaseClient,
  userId: string,
  title: string
) {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, title })
    .select()
    .single();

  if (error) throw error;
  return data as Conversation;
}

export async function saveMessage(
  supabase: SupabaseClient,
  conversationId: string,
  role: "user" | "assistant",
  content: string
) {
  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role, content });

  if (error) throw error;

  // Update the conversation's updated_at timestamp so it sorts to the top.
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function deleteConversation(
  supabase: SupabaseClient,
  conversationId: string
) {
  // ON DELETE CASCADE in the schema means deleting a conversation
  // automatically deletes all its messages too.
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId);

  if (error) throw error;
}
