"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
  code: string;
  title?: string;
}

// Renders Mermaid syntax as an SVG diagram inside the chat.
// Mermaid runs client-side only — it parses the text DSL and generates SVG.
// We use a ref + useEffect pattern because Mermaid manipulates the DOM directly.
export function MermaidDiagram({ code, title }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function renderDiagram() {
      if (!containerRef.current) return;

      try {
        // Dynamic import — mermaid is a large library (~500KB), so we only
        // load it when a diagram actually needs rendering, not on every page load.
        const mermaid = (await import("mermaid")).default;

        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
        });

        // mermaid.render() takes an id + code, returns { svg: string }
        const { svg } = await mermaid.render(
          `mermaid-${Date.now()}`,
          code
        );
        containerRef.current.innerHTML = svg;
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to render diagram"
        );
      }
    }

    renderDiagram();
  }, [code]);

  return (
    <div className="my-3">
      {title && (
        <p className="text-xs font-medium text-muted mb-2">{title}</p>
      )}
      {error ? (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-xs">
          <p className="font-medium mb-1">Diagram rendering failed</p>
          <pre className="whitespace-pre-wrap">{code}</pre>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-border overflow-x-auto [&_svg]:max-w-full"
        />
      )}
    </div>
  );
}
