// MCP Server Configuration
//
// This is where you declare which external MCP servers KT-Killer should connect to.
// Each entry describes how to spawn the server process.
//
// In production, this config would come from a database (per-org MCP servers),
// an admin UI, or environment variables. For now, it's hardcoded.

import type { McpServerConfig } from "./mcp-client";
import path from "path";

export function getMcpServerConfigs(): McpServerConfig[] {
  const projectRoot = process.cwd();

  return [
    {
      name: "team-directory",
      command: "node",
      args: [path.join(projectRoot, "mcp-servers/team-directory/dist/index.js")],
    },
    // Add more MCP servers here as they become available:
    // {
    //   name: "jira",
    //   command: "node",
    //   args: [path.join(projectRoot, "mcp-servers/jira/dist/index.js")],
    //   env: { JIRA_TOKEN: process.env.JIRA_TOKEN ?? "" },
    // },
  ];
}
