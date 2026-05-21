-- Phase 2: RAG Schema — Multi-tenancy + Document Storage + Vector Search
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New Query → Paste → Run

-- Enable pgvector extension.
-- This adds the "vector" data type and similarity search operators to Postgres.
-- Supabase includes pgvector out of the box — we just need to enable it.
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- MULTI-TENANCY: Organizations and Profiles
-- ============================================

-- Table: organizations
-- Each company using KT-Killer is an organization (tenant).
-- All data (spaces, documents, chunks) is scoped to an org.
CREATE TABLE organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Table: profiles
-- Extends Supabase auth.users with organization membership and role.
-- Every authenticated user must have a profile to use the app.
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- KNOWLEDGE BASE: Spaces, Documents, Chunks
-- ============================================

-- Table: spaces
-- Logical groupings of documents within an org.
-- e.g., "Engineering", "HR & Policies", "Onboarding"
CREATE TABLE spaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Table: documents
-- Metadata about uploaded files. The actual content is in chunks.
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'markdown' CHECK (file_type IN ('markdown', 'pdf', 'text')),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Table: document_chunks
-- The actual indexed content. Each row is a chunk of a document with its embedding vector.
-- org_id is denormalized here for fast RLS filtering during vector search
-- (avoids joining through documents → spaces → org on every query).
--
-- The vector(1536) type stores a 1536-dimensional embedding.
-- 1536 is the output size of OpenAI's text-embedding-3-small model.
CREATE TABLE document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Helper: get the current user's org_id from their profile.
-- Used in all RLS policies below.
-- This is a SQL function that Postgres evaluates for every row check.
-- We put it in the public schema (not auth) because Supabase restricts auth schema modifications.
CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Organizations: users can only see their own org
CREATE POLICY "Users can view their own org"
  ON organizations FOR SELECT
  USING (id = public.user_org_id());

-- Profiles: users can see profiles within their org
CREATE POLICY "Users can view profiles in their org"
  ON profiles FOR SELECT
  USING (org_id = public.user_org_id());

-- Profiles: users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Spaces: users can view spaces in their org
CREATE POLICY "Users can view spaces in their org"
  ON spaces FOR SELECT
  USING (org_id = public.user_org_id());

-- Spaces: only admins can create/update/delete spaces
CREATE POLICY "Admins can manage spaces"
  ON spaces FOR ALL
  USING (
    org_id = public.user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    org_id = public.user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Documents: users can view documents in their org
CREATE POLICY "Users can view documents in their org"
  ON documents FOR SELECT
  USING (org_id = public.user_org_id());

-- Documents: only admins can create/update/delete documents
CREATE POLICY "Admins can manage documents"
  ON documents FOR ALL
  USING (
    org_id = public.user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    org_id = public.user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Document chunks: users can view chunks in their org
CREATE POLICY "Users can view chunks in their org"
  ON document_chunks FOR SELECT
  USING (org_id = public.user_org_id());

-- Document chunks: only admins can manage chunks
CREATE POLICY "Admins can manage chunks"
  ON document_chunks FOR ALL
  USING (
    org_id = public.user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    org_id = public.user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- INDEXES
-- ============================================

-- Index for fast org-scoped queries
CREATE INDEX idx_spaces_org_id ON spaces(org_id);
CREATE INDEX idx_documents_org_id ON documents(org_id);
CREATE INDEX idx_documents_space_id ON documents(space_id);
CREATE INDEX idx_chunks_document_id ON document_chunks(document_id);

-- Vector similarity search index using HNSW (Hierarchical Navigable Small World).
-- This is what makes vector search fast — without it, Postgres would do a brute-force
-- scan of every row. HNSW is an approximate nearest neighbor algorithm that trades
-- a tiny bit of accuracy for massive speed gains.
-- The vector_cosine_ops tells pgvector to use cosine distance for similarity.
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- Also update the Phase 1 conversations table to link to org
ALTER TABLE conversations ADD COLUMN org_id UUID REFERENCES organizations(id);

-- ============================================
-- VECTOR SEARCH FUNCTION
-- ============================================

-- This function performs the RAG retrieval.
-- It embeds the query (done in application code), then finds the most similar chunks
-- within the user's organization.
--
-- Why a database function instead of a raw query?
-- 1. Supabase RPC calls are cleaner from the client
-- 2. We can encapsulate the similarity logic in one place
-- 3. It's easier to optimize later (add re-ranking, filters, etc.)
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_org_id UUID,
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  chunk_index INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE dc.org_id = match_org_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
