import { createBrowserClient } from "@supabase/ssr";

// This creates a Supabase client for use in the BROWSER (React components).
//
// Why a separate browser client?
// In the browser, auth tokens are stored in cookies via document.cookie.
// createBrowserClient knows how to read/write cookies in the browser context.
//
// This is safe to call multiple times — Supabase internally caches the client.
// The NEXT_PUBLIC_ prefix means these env vars are available in browser code.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
