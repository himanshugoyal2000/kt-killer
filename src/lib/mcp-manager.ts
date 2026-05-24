// MCP Connection Manager
//
// Problem: Each chat API request needs access to MCP tools, but we can't spawn
// new MCP server processes on every request — that would be slow and wasteful.
//
// Solution: A module-level singleton that connects once per Node.js process lifetime.
// In Next.js dev mode, this survives hot reloads. In production (Vercel serverless),
// each cold start reconnects, but warm invocations reuse the connection.
//
// This is a common pattern for managing external connections in serverless:
// Postgres pools, Redis clients, and now MCP clients all use this approach.

import { discoverMcpTools, disconnectAll } from "./mcp-client";
import { getMcpServerConfigs } from "./mcp-config";
import { tool } from "ai";

let cachedTools: Record<string, ReturnType<typeof tool>> | null = null;
let connectionPromise: Promise<Record<string, ReturnType<typeof tool>>> | null = null;

export async function getMcpTools(): Promise<Record<string, ReturnType<typeof tool>>> {
  if (cachedTools) return cachedTools;

  // Prevent multiple simultaneous connection attempts (race condition guard).
  // If another request is already connecting, wait for that same promise.
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    try {
      const configs = getMcpServerConfigs();
      if (configs.length === 0) return {};

      const tools = await discoverMcpTools(configs);
      cachedTools = tools;

      console.log(
        `[MCP] Connected to ${configs.length} server(s), discovered ${Object.keys(tools).length} tools:`,
        Object.keys(tools)
      );

      return tools;
    } catch (error) {
      console.error("[MCP] Failed to initialize MCP connections:", error);
      return {};
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

// For graceful shutdown (not strictly needed in serverless, but good practice)
export async function shutdownMcp() {
  await disconnectAll();
  cachedTools = null;
}
