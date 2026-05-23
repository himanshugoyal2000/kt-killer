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
- Multi-step reasoning (agent loop: think → act → observe → think)
- Summary generation across multiple documents
- Document catalog browsing
- Removed hardcoded RAG — LLM decides when to search

### AI Concepts Learned
- Function calling / tool use (OpenAI function calling via Vercel AI SDK `tool()`)
- Agent loops (ReAct pattern via `stopWhen: stepCountIs(5)`)
- How to define tools with Zod schemas (`inputSchema`)
- Multi-step task execution (search → diagram in one query)
- When to use agents vs. simple chains vs. direct prompts
- Rendering non-text streaming parts (tool activity indicators, Mermaid diagrams)

### Architecture
```
User Query → LLM sees available tools → decides what to do:
  "hi"                      → answers directly, no tool call
  "retry policy?"           → searchKnowledgeBase → answer with citations
  "what docs do you have?"  → listDocuments → summarize catalog
  "draw architecture"       → searchKnowledgeBase → generateDiagram → render Mermaid
  "summarize all runbooks"  → summarizeDocuments → cross-document summary
```

### Key Files
- `src/lib/tools.ts` — All tool definitions (searchKnowledgeBase, listDocuments, generateDiagram, summarizeDocuments)
- `src/app/api/chat/route.ts` — Refactored: removed hardcoded RAG, added tools + agent loop with `stopWhen`
- `src/components/chat-message.tsx` — Updated to render tool activity (loading dots, done indicators, diagrams)
- `src/components/mermaid-diagram.tsx` — Renders Mermaid syntax as SVG via dynamic import

### Lessons Learned
- AI SDK v6 renamed `parameters` to `inputSchema` and `maxSteps` to `stopWhen: stepCountIs(n)`
- Tool parts in v6 use type `tool-${toolName}` (e.g. `tool-searchKnowledgeBase`), not `tool-invocation` or `dynamic-tool`
- Tool states are `input-streaming` → `input-available` → `output-available`, not `call` → `result`
- Always log raw `message.parts` when debugging streaming UI — the actual structure often differs from docs
- Tools need per-request context (Supabase client, org_id) — use a factory function, not static constants

### Status: COMPLETED

---

## Phase 4: MCP — Making KT-Killer a Platform

### What Gets Built
- Turn KT-Killer's knowledge base into an MCP Server that any MCP client can connect to
- Make KT-Killer an MCP Client that can connect to external MCP servers
- Connect to a real third-party MCP server (e.g., Confluence)
- Admin UI to configure which MCP servers an org connects to

### AI Concepts Learned
- MCP protocol (JSON-RPC, tools/resources/prompts)
- MCP Server development (expose your tools as a standard service)
- MCP Client integration (consume external tools dynamically)
- Dynamic tool registration (tools discovered at runtime, not hardcoded)
- The "platform vs application" mindset

### Architecture
```
KT-Killer as MCP Client:
  User Query → LLM → decides which tool → could be:
    ├── Internal tool (searchKnowledgeBase)
    ├── Confluence MCP Server → search live Confluence pages
    ├── Slack MCP Server → search Slack history
    └── Any custom MCP Server the company plugs in

KT-Killer as MCP Server:
  External MCP Client (Cursor, Claude Desktop, etc.)
    → connects to KT-Killer MCP Server
    → can search the company knowledge base from any AI tool
```

### Status: NOT STARTED

---

## Phase 5: Goal-Based Agents + Structured Output + Model Agnosticism

### What Gets Built
- Goal-based autonomous agent: user defines a goal, agent plans steps, executes iteratively until done
- Example task: "Audit all runbooks and report which ones are missing error handling sections"
- Agent planner: LLM generates a structured plan (steps, dependencies, success criteria)
- Agent executor: loop that runs steps, checks progress, adapts plan if a step fails
- Agent memory: tracks completed steps, partial results, and remaining work
- Structured JSON responses via `generateObject` with Zod schema validation
- Model switcher: swap between OpenAI GPT-4o, Anthropic Claude, Google Gemini via AI SDK provider registry
- Per-org model configuration (each tenant can pick their preferred LLM)

### AI Concepts Learned
- Goal-oriented agents vs reactive agents (Phase 3)
- Planning: LLM generates a structured execution plan before acting
- Iterative execution with progress tracking and plan adaptation
- Structured output / JSON mode (`generateObject` in AI SDK)
- Output validation with Zod schemas
- Provider abstraction (AI SDK model registry)
- Few-shot prompting, chain-of-thought, prompt templates
- How different models behave differently on the same prompt
- When autonomous agents are worth the cost and complexity

### Architecture
```
User sets goal: "Audit all runbooks for missing sections"
  → LLM generates plan:
      Step 1: List all runbooks (listDocuments tool)
      Step 2: For each runbook, search for error handling section
      Step 3: Compile findings into structured report
  → Agent loop:
      Execute step 1 → got 5 runbooks → update memory
      Execute step 2a → payments runbook has error handling → log result
      Execute step 2b → inventory runbook missing error handling → log result
      ...
      Execute step 3 → generate structured audit report
  → Return final report with structured JSON + human-readable summary
```

### Status: NOT STARTED

---

## Phase 6: Evals + Observability — Testing AI Systems

### What Gets Built
- Golden test set: 30+ question/expected-answer pairs for KT-Killer
- Automated eval runner that scores retrieval quality (did we find the right chunks?) and answer quality (did the LLM answer correctly?)
- LLM-as-judge: use a strong model to grade a weaker model's answers
- Observability: log every request with query, retrieved chunks, similarity scores, tool calls, tokens used, latency, cost
- Dashboard to visualize eval results and query analytics

### AI Concepts Learned
- How to write evals for RAG systems (retrieval precision/recall, answer correctness)
- LLM-as-judge pattern (using GPT-4o to evaluate GPT-4o-mini)
- Regression testing for AI (did a prompt change break existing answers?)
- Observability for AI apps (what to log, how to analyze)
- Cost tracking and token budgeting

### Status: NOT STARTED

---

## Phase 7: Production Hardening

### What Gets Built
- Rate limiting per user/org (token bucket or sliding window)
- Semantic caching (embed the query, check if a similar query was answered recently)
- Input guardrails (prompt injection detection, PII scrubbing)
- Output guardrails (hallucination detection, off-topic filtering)
- Fallback models (if OpenAI is down, route to Anthropic)
- Graceful degradation (if RAG fails, answer with disclaimer)

### AI Concepts Learned
- Semantic caching (embedding-based cache key matching)
- Prompt injection attacks and defenses
- Guardrails patterns (pre-processing, post-processing, circuit breakers)
- Fallback and retry strategies for LLM APIs
- Cost optimization (prompt compression, model routing by query complexity)

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
| MCP | USB-C for AI tools. A standard protocol so any AI app can connect to any tool provider. |
| Structured Output | Forcing the LLM to return valid JSON matching a schema, instead of free-form text. |
| Evals | Test suites for AI. Question/expected-answer pairs that verify your system works correctly. |
| LLM-as-Judge | Using a strong model (GPT-4o) to grade a weaker model's answers. Cheaper than human eval. |
| Prompt Injection | When a user tricks the LLM into ignoring its instructions. The SQL injection of AI. |
| Semantic Cache | Cache that matches by meaning, not exact string. "retry policy" and "what is the retry strategy" hit the same cache entry. |
| Goal-Based Agent | An autonomous agent that takes a high-level goal, plans steps, and iterates until the goal is met. Unlike reactive agents that answer one question, these execute multi-step tasks. |

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
