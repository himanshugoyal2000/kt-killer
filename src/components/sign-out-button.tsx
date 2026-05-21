"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-muted hover:text-foreground transition-colors"
    >
      Sign Out
    </button>
  );
}
