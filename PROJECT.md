# KT-Killer: AI-Powered Company Brain

**Live URL:** https://kt-killer-c3ubud3nu-himanshugoyal2000s-projects.vercel.app/

## What Is This?

An AI-powered knowledge hub that any company can plug into — regardless of scale. It ingests a company's scattered knowledge (docs, wikis, runbooks, Confluence, Slack, Jira, code repos) and becomes the single place to ask anything about the company.

This is a "Company Brain" — one of YC's identified high-potential AI application areas.

## Who Is Building This?

A backend software engineer with 3 years of experience at Walmart. Strong in Java, Spring Boot, Kafka, BigQuery, Airflow, Spark, MongoDB, Cassandra, and CI/CD. Learning AI engineering from scratch — building this project to learn every major AI pattern hands-on.

## Tech Stack

| Layer           | Technology                                    |
|-----------------|-----------------------------------------------|
| Frontend        | Next.js (React) on Vercel                     |
| Backend/API     | Next.js API Routes (serverless functions)     |
| Database        | Supabase (Postgres + pgvector for embeddings) |
| Auth            | Supabase Auth                                 |
| LLM             | OpenAI API (GPT-4o) — Anthropic added later   |
| File Storage    | Supabase Storage (for uploaded docs)          |
| Language        | TypeScript throughout                         |
| Deployment      | Vercel (frontend + API) + Supabase (DB + auth)|

## Learning Goals

This project is structured as a learning path. Each phase teaches specific AI engineering concepts while adding real features to the product.

---

## Phase 1: Chat Interface + LLM Integration

### What Gets Built
- Clean web UI with chat interface
- Supabase auth (sign up / sign in)
- OpenAI API integration with streaming responses
- Conversation history stored in Supabase Postgres
- Deployed on Vercel with a live URL

### AI Concepts Learned
- How LLM APIs work (request format, tokens, streaming)
- Prompt engineering (system prompts, few-shot examples, structured output)
- Streaming responses (Server-Sent Events)
- Token economics (how pricing works)
- Temperature and its effect on output
- Vercel AI SDK

### Architecture
```
Browser (React) → Next.js API Route (/api/chat) → OpenAI API (GPT-4o)
                                    ↕
                              Supabase Postgres
                              (auth + chat history)
```

### Key Files (planned)
- `src/app/page.tsx` — Chat UI
- `src/app/api/chat/route.ts` — API route that calls OpenAI
- `src/lib/supabase.ts` — Supabase client setup
- `src/components/ChatMessage.tsx` — Message bubble component
- `src/components/ChatInput.tsx` — Input component

### Status: COMPLETED

---

## Phase 2: RAG — Grounded in Real Knowledge

### What Gets Built
- Document upload (PDFs, markdown, text files)
- Text chunking pipeline (split docs into pieces)
- Embedding generation (convert chunks to vectors via OpenAI embeddings API)
- Vector storage in Supabase pgvector
- RAG retrieval: user question → find relevant chunks → inject into prompt
- Citations in responses ("Based on onboarding-guide.md, section 3...")
- Sources panel in UI showing referenced documents

### AI Concepts Learned
- Embeddings — what they are, how they work
- Vector databases / pgvector
- Text chunking strategies (fixed size, semantic, recursive)
- Cosine similarity and nearest-neighbor search
- RAG pipeline architecture
- Retrieval quality evaluation
- The "lost in the middle" problem (LLMs pay less attention to middle of context)

### Architecture
```
Upload Flow:
  Document → Chunker → OpenAI Embeddings API → Supabase pgvector

Query Flow:
  User Question → Embed Question → pgvector similarity search
       → Top-K chunks retrieved → Injected into prompt → OpenAI → Response with citations
```

### Key Files
- `supabase/phase2_schema.sql` — Multi-tenant schema (orgs, profiles, spaces, documents, chunks with pgvector + RLS)
- `supabase/seed.sql` — Seeds NovaMart org, user profile, and spaces
- `docs/novamart/*.md` — 11 fictional company documents for testing
- `scripts/seed-docs.ts` — Bulk ingestion script (chunk → embed → store)
- `src/lib/chunker.ts` — Recursive markdown splitter (1500 char chunks, 200 char overlap)
- `src/lib/embeddings.ts` — OpenAI text-embedding-3-small wrapper (single + batch)
- `src/lib/ingest.ts` — Ingestion orchestrator (chunk → embed → store in Supabase)
- `src/lib/rag.ts` — RAG retrieval (embed query → vector search via RPC → enrich with metadata)
- `src/app/api/documents/route.ts` — Document upload API (admin-only)
- `src/app/api/chat/route.ts` — Updated to inject RAG context into system prompt

### Lessons Learned
- pgvector RPC requires embeddings as JSON strings, not raw arrays — silent failure otherwise
- `text-embedding-3-small` cosine similarity tops out ~0.6 for good matches; threshold of 0.3 works, 0.7 is too aggressive
- Supabase free tier blocks `auth` schema modifications — use `public` schema for custom SQL functions
- `SECURITY DEFINER` on `user_org_id()` is necessary to avoid circular RLS dependency (function reads profiles, profiles has RLS that calls the function)
- Larger chunks = lower similarity scores but richer context; smaller chunks = higher scores but fragmented context

### Status: COMPLETED

---

## Phase 3: Agents & Tools — The Brain Takes Action

### What Gets Built
- Tool/function calling (LLM decides which tools to invoke)
- Diagram generation (Mermaid architecture diagrams)
- Structured data extraction from documents
- Multi-step reasoning (agent loop: think → act → observe → think)
- Web search integration (for up-to-date information)
- Summary generation across multiple documents

### AI Concepts Learned
- Function calling / tool use (OpenAI function calling API)
- Agent loops (ReAct pattern: Reasoning + Acting)
- How to define tools with JSON schemas
- Multi-step task execution
- Error handling for non-deterministic systems
- When to use agents vs. simple chains vs. direct prompts

### Architecture
```
User Query → Router (decide if tools needed)
  → Simple Q&A: direct LLM call
  → Needs tools: Agent Loop
       → LLM decides tool + arguments
       → Execute tool (search, diagram, summarize, etc.)
       → Feed result back to LLM
       → LLM decides: done or need another tool?
       → Final response to user
```

### Status: NOT STARTED

---

## Phase 4: Production Hardening

### What Gets Built
- Rate limiting and usage quotas per user
- Semantic caching (similar questions hit cache)
- Guardrails (input validation, output safety, PII detection)
- Observability dashboard (queries, latency, cost, token usage)
- Evaluation pipeline (automated tests for answer quality)
- Fallback models (if OpenAI is down, route to Anthropic)
- Error handling and graceful degradation

### AI Concepts Learned
- LLM observability and tracing (LangSmith / Langfuse)
- Semantic caching (using embeddings to match "similar enough" queries)
- Guardrails and safety patterns
- Evaluation: how to test AI systems (golden test sets, LLM-as-judge)
- Cost optimization (token budgeting, prompt compression)
- Latency optimization (streaming, parallel calls, caching)
- Deployment patterns for AI apps

### Status: NOT STARTED

---

## Phase 5: Multi-Agent System

### What Gets Built
- Router agent that classifies queries and delegates to specialists
- Search Agent — finds information across the knowledge base
- Summarizer Agent — creates summaries of documents or topics
- Onboarding Agent — answers new employee questions with step-by-step guides
- Incident Agent — helps debug issues by searching docs + suggesting solutions
- Agent communication protocol (agents can consult each other)

### AI Concepts Learned
- Multi-agent orchestration patterns
- Agent routing and classification
- Agent communication and handoff
- Parallel agent execution
- Consensus and conflict resolution between agents
- When multi-agent is worth the complexity (and when it's not)

### Architecture
```
User Query → Router Agent
  → Classifies intent
  → Delegates to 1+ specialist agents
  → Each agent may use RAG + tools
  → Results synthesized into final response
  → Response has labeled sections from each specialist
```

### Status: NOT STARTED

---

## Buzzword Glossary

Quick reference for AI terms mapped to backend engineering concepts:

| Term | What It Is |
|------|-----------|
| LLM | A stateless API: text in → text out. Like a `String process(String input)` method. |
| Token | The unit LLMs read/write. ~4 chars = 1 token. You pay per token. |
| Prompt | The input string to the LLM. Like writing a good SQL query — same model, different results. |
| Context Window | Max input+output size per call. Like a request body size limit. |
| RAG | Fetch relevant docs → paste into prompt → send to LLM. Like a JOIN but for AI. |
| Embeddings | Function that converts text to a numeric vector. Similar meaning = similar vectors. |
| Vector Database | DB optimized for "find nearest neighbors" queries instead of field filters. |
| Fine-tuning | Retrain a model on your data. Expensive, usually unnecessary — prefer RAG. |
| Agents | LLM in a loop that calls tools (APIs, DBs, code). LLM decides which tool + what args. |
| Tool Calling | LLM says "call function X with args Y." You define functions, model picks which to call. |
| Hallucination | Model confidently makes up false info. #1 reliability problem. |
| Guardrails | Validation middleware for AI — check inputs/outputs for safety and correctness. |
| Temperature | 0 = deterministic, 1+ = creative/random. Config knob for response style. |
| Streaming | Response comes token-by-token (SSE) instead of all at once. Like Kafka but for API responses. |
| Inference | Running a model to get output. Calling the OpenAI API = doing inference. |

---

## Pre-Phase 1 Reading List

1. **How LLMs work (conceptual):** https://writings.stephenwolfram.com/2023/02/what-is-chatgpt-doing-and-why-does-it-work/ — first 15 min, skip the math
2. **OpenAI Chat Completions API:** https://platform.openai.com/docs/guides/text-generation — request/response format, streaming, parameters
3. **Vercel AI SDK intro:** https://sdk.vercel.ai/docs/introduction — just the intro + getting started
4. **Supabase Next.js quickstart:** https://supabase.com/docs/guides/getting-started/quickstarts/nextjs — skim for familiarity

---

## Accounts Needed

- [ ] OpenAI API key — `platform.openai.com` → API Keys → Create new key
- [ ] Supabase project — `supabase.com` → New Project → note URL + anon key
- [ ] Vercel account — `vercel.com` → sign up with GitHub
- [ ] GitHub repo for kt-killer

---

## Design Principles

1. **Pluggable into any company** — no hardcoded company-specific logic. Data sources are configurable.
2. **Scale-agnostic** — works for a 10-person startup and a 100K-person enterprise.
3. **Learn by building** — every line of code serves a learning purpose. No copy-paste black boxes.
4. **Ship incrementally** — each phase is deployable. Always have a working live URL.
5. **Production mindset** — even while learning, build with observability, error handling, and testing.
6. **No vibe coding** — every dependency, file, and pattern must be explained (why it exists, what problem it solves) before it's added. If something feels like a black box, stop and ask.
