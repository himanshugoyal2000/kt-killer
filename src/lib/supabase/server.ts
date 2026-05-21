import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// This creates a Supabase client for use on the SERVER (API routes, middleware, server components).
//
// Why different from the browser client?
// On the server, there's no document.cookie. Instead, cookies come from the
// incoming HTTP request headers. Next.js provides a cookies() function to
// read/write them. We pass cookie handlers to Supabase so it can manage
// the auth session server-side.
//
// This must be called fresh for each request — not cached globally —
// because each request has different cookies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from Server Components where cookies can't be set.
            // This is safe to ignore — the middleware handles cookie refreshing.
          }
        },
      },
    }
  );
}
