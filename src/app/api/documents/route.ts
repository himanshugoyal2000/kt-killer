import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ingestDocument } from "@/lib/ingest";

// POST /api/documents — Upload and ingest a document
// Expects JSON body: { title, content, spaceId, fileType? }
// Only admins can upload documents (enforced by RLS on the documents table).
export async function POST(req: Request) {
  const supabase = await createClient();

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the user's profile to find their org_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Only admins can upload documents" }, { status: 403 });
  }

  const body = await req.json();
  const { title, content, spaceId, fileType } = body;

  if (!title || !content || !spaceId) {
    return NextResponse.json(
      { error: "title, content, and spaceId are required" },
      { status: 400 }
    );
  }

  try {
    const result = await ingestDocument({
      supabase,
      orgId: profile.org_id,
      spaceId,
      title,
      content,
      fileType,
      uploadedBy: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Ingestion error:", error);
    return NextResponse.json(
      { error: "Failed to ingest document" },
      { status: 500 }
    );
  }
}

// GET /api/documents — List documents (for the admin UI)
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: documents, error } = await supabase
    .from("documents")
    .select("*, spaces(name)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(documents);
}
