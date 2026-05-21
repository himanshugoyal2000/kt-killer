# KT-Killer

AI-powered Company Brain — a knowledge hub that any company can plug into.

## Tech Stack

- **Frontend:** Next.js (React) + Tailwind CSS
- **Backend:** Next.js API Routes (serverless)
- **Database:** Supabase (Postgres)
- **Auth:** Supabase Auth (invite-only)
- **LLM:** OpenAI GPT-4o-mini via Vercel AI SDK
- **Language:** TypeScript

## Setup

### 1. Clone and install

```bash
git clone https://github.com/himanshugoyal2000/kt-killer.git
cd kt-killer
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in the values:
- `OPENAI_API_KEY` — from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase dashboard → Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase dashboard → Settings → API → anon public key

### 3. Set up the database

Run the SQL in `supabase/schema.sql` in your Supabase SQL Editor to create the required tables.

### 4. Configure auth

In Supabase dashboard → Authentication → Providers → Email:
- Disable "Allow new users to sign up" (invite-only mode)
- Create users manually via Authentication → Users → Add User

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── api/chat/route.ts    # API endpoint that talks to OpenAI
│   ├── auth/page.tsx         # Sign-in page
│   ├── page.tsx              # Main chat page
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   ├── chat-input.tsx        # Message input box
│   ├── chat-message.tsx      # Message bubble
│   ├── loading-spinner.tsx   # Loading spinner
│   ├── sidebar.tsx           # Conversation history sidebar
│   ├── sign-out-button.tsx   # Sign out button
│   └── typing-indicator.tsx  # Bouncing dots while AI is thinking
└── lib/
    ├── db.ts                 # Database helper functions (DAO layer)
    └── supabase/
        ├── client.ts         # Supabase client for browser
        └── server.ts         # Supabase client for server
```
