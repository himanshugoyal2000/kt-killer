-- KT-Killer Database Schema
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New Query → Paste → Run

-- Table: conversations
-- Stores one row per chat conversation, linked to the user who created it.
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Table: messages
-- Stores every message in every conversation.
-- role is either 'user' or 'assistant'.
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS) on both tables.
-- Without RLS, anyone with the anon key could read all data.
-- With RLS, every query is automatically filtered by the policies below.
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/create/update/delete their own conversations.
-- auth.uid() returns the currently logged-in user's ID from the JWT token.
CREATE POLICY "Users can manage their own conversations"
  ON conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only access messages in their own conversations.
-- This joins through the conversations table to check ownership.
CREATE POLICY "Users can manage messages in their own conversations"
  ON messages FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

-- Index for fast lookups: get all conversations for a user, newest first.
CREATE INDEX idx_conversations_user_id ON conversations(user_id, updated_at DESC);

-- Index for fast lookups: get all messages for a conversation, in order.
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id, created_at ASC);
