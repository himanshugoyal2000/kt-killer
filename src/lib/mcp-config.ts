// MCP Server Configuration
//
// Declares which external MCP servers KT-Killer connects to.
// Supports two transport types:
//   - "http": remote servers accessible via URL (works on Vercel)
//   - "stdio": local servers spawned as child processes (dev only)
//
// In production, this config would come from a database (per-org MCP servers)
// or an admin UI. For now, it's hardcoded.

import type { McpServerConfig } from "./mcp-client";
import path from "path";

export function getMcpServerConfigs(): McpServerConfig[] {
  const configs: McpServerConfig[] = [];

  // DeepWiki — free, public, no-auth MCP server.
  // Provides tools to search and read documentation from any GitHub repository.
  // This is an open source project: https://github.com/AsyncFuncAI/deepwiki-open
  configs.push({
    name: "deepwiki",
    transport: "http",
    url: "https://mcp.deepwiki.com/mcp",
  });

  // Team Directory — local stdio server (only works in local dev, not on Vercel).
  // Uncomment to use locally:
  // const projectRoot = process.cwd();
  // configs.push({
  //   name: "team-directory",
  //   transport: "stdio",
  //   command: "node",
  //   args: [path.join(projectRoot, "mcp-servers/team-directory/dist/index.js")],
  // });

  return configs;
}
