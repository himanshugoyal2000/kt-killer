"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Space {
  id: string;
  name: string;
  description: string | null;
}

interface Document {
  id: string;
  title: string;
  file_type: string;
  created_at: string;
  spaces: { name: string } | null;
}

export default function AdminPage() {
  const supabase = createClient();

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedSpace, setSelectedSpace] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: spacesData } = await supabase
        .from("spaces")
        .select("*")
        .order("name");
      if (spacesData) setSpaces(spacesData);

      const res = await fetch("/api/documents");
      if (res.ok) {
        const docs = await res.json();
        setDocuments(docs);
      }
    }
    load();
  }, []);

  const handleUpload = async () => {
    if (!title || !content || !selectedSpace) {
      setMessage("Please fill in all fields");
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          spaceId: selectedSpace,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(`Error: ${data.error}`);
      } else {
        setMessage(
          `Document "${title}" uploaded successfully (${data.chunksCreated} chunks created)`
        );
        setTitle("");
        setContent("");
        // Refresh document list
        const docsRes = await fetch("/api/documents");
        if (docsRes.ok) setDocuments(await docsRes.json());
      }
    } catch {
      setMessage("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setContent(text);
    if (!title) {
      setTitle(file.name.replace(/\.(md|txt)$/, ""));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Knowledge Base Admin</h1>
          <p className="text-sm text-muted mt-1">Upload and manage documents</p>
        </div>
        <a
          href="/"
          className="text-sm text-primary hover:underline"
        >
          Back to Chat
        </a>
      </div>

      {/* Upload Form */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-8">
        <h2 className="text-lg font-medium mb-4">Upload Document</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Space</label>
            <select
              value={selectedSpace}
              onChange={(e) => setSelectedSpace(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select a space...</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Payment Service Runbook"
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Content (paste markdown or upload a file)
            </label>
            <div className="mb-2">
              <input
                type="file"
                accept=".md,.txt"
                onChange={handleFileUpload}
                className="text-sm text-muted"
              />
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder="Paste your markdown content here..."
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/50 resize-y"
            />
          </div>

          {message && (
            <p
              className={`text-sm ${message.startsWith("Error") ? "text-red-500" : "text-green-600"}`}
            >
              {message}
            </p>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {uploading ? "Uploading & Embedding..." : "Upload Document"}
          </button>
        </div>
      </div>

      {/* Document List */}
      <div>
        <h2 className="text-lg font-medium mb-4">
          Uploaded Documents ({documents.length})
        </h2>

        {documents.length === 0 ? (
          <p className="text-sm text-muted">No documents uploaded yet.</p>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Title</th>
                  <th className="text-left px-4 py-3 font-medium">Space</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-t border-border">
                    <td className="px-4 py-3">{doc.title}</td>
                    <td className="px-4 py-3 text-muted">
                      {doc.spaces?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">{doc.file_type}</td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
