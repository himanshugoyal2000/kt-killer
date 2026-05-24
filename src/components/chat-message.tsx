"use client";

import type { UIMessage } from "ai";
import { MermaidDiagram } from "./mermaid-diagram";

interface ChatMessageProps {
  message: UIMessage;
}

// In AI SDK v6, tool invocations appear as parts with:
//   - type: "tool-{toolName}" (e.g. "tool-searchKnowledgeBase")
//   - state: "input-streaming" | "input-available" | "output-available" | "output-error"
//   - input (the args), output (the result)
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-white"
            : "bg-surface border border-border text-foreground"
        }`}
      >
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            if (!part.text) return null;
            return (
              <span key={index} className="whitespace-pre-wrap">
                {part.text}
              </span>
            );
          }

          // Tool parts have type "tool-{toolName}"
          if (part.type.startsWith("tool-")) {
            const toolName = part.type.slice(5); // remove "tool-" prefix
            return (
              <ToolDisplay
                key={index}
                toolName={toolName}
                part={part as any}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

function ToolDisplay({ toolName, part }: { toolName: string; part: any }) {
  const { state, input, output } = part;

  if (state === "input-streaming" || state === "input-available") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted py-2">
        <LoadingDots />
        <span>{getToolLabel(toolName, input)}</span>
      </div>
    );
  }

  if (state === "output-error") {
    return (
      <div className="text-xs text-red-500 py-1">
        Tool error: {part.errorText}
      </div>
    );
  }

  if (state === "output-available" && output) {
    if (toolName === "generateDiagram") {
      try {
        const diagram = JSON.parse(output);
        return (
          <MermaidDiagram code={diagram.mermaidCode} title={diagram.title} />
        );
      } catch {
        return null;
      }
    }

    return (
      <div className="flex items-center gap-2 text-xs text-muted py-1 opacity-60">
        <span>✓</span>
        <span>{getToolDoneLabel(toolName)}</span>
      </div>
    );
  }

  return null;
}

function LoadingDots() {
  return (
    <span className="inline-flex gap-0.5">
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

function getToolLabel(toolName: string, input: any): string {
  // MCP tools are prefixed: "serverName__toolName" — extract the base name
  const baseName = toolName.includes("__") ? toolName.split("__")[1] : toolName;

  switch (baseName) {
    case "searchKnowledgeBase":
      return `Searching knowledge base for "${input?.query ?? "..."}"`;
    case "listDocuments":
      return "Fetching document catalog...";
    case "generateDiagram":
      return `Generating ${input?.diagramType ?? ""} diagram...`;
    case "summarizeDocuments":
      return `Gathering documents about "${input?.topic ?? "..."}"`;
    case "lookupEmployee":
      return `Looking up "${input?.name ?? "..."}" in team directory...`;
    case "findTeamMembers":
      return "Searching team directory...";
    case "getOrgChart":
      return "Fetching org chart...";
    default:
      return `Running ${formatToolName(baseName)}...`;
  }
}

function getToolDoneLabel(toolName: string): string {
  const baseName = toolName.includes("__") ? toolName.split("__")[1] : toolName;

  switch (baseName) {
    case "searchKnowledgeBase":
      return "Searched knowledge base";
    case "listDocuments":
      return "Fetched documents";
    case "summarizeDocuments":
      return "Gathered documents";
    case "lookupEmployee":
      return "Found employee info";
    case "findTeamMembers":
      return "Found team members";
    case "getOrgChart":
      return "Retrieved org chart";
    default:
      return `${formatToolName(baseName)} complete`;
  }
}

function formatToolName(name: string): string {
  return name.replace(/([A-Z])/g, " $1").trim().toLowerCase();
}
