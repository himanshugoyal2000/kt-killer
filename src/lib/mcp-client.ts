// MCP Client — connects to external MCP servers and wraps their tools for the AI SDK.
//
// Supports two transport types:
//   - "stdio": spawns the server as a local child process (for dev / local servers)
//   - "http": connects to a remote server over Streamable HTTP (for production / Vercel)
//
// The LLM doesn't know which transport a tool uses — it just sees a flat tool list.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { tool } from "ai";
import { jsonSchema } from "ai";

// Config for a remote HTTP MCP server (works on Vercel + everywhere)
export interface McpHttpServerConfig {
  name: string;
  transport: "http";
  url: string;
}

// Config for a local stdio MCP server (dev only, not on Vercel)
export interface McpStdioServerConfig {
  name: string;
  transport: "stdio";
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export type McpServerConfig = McpHttpServerConfig | McpStdioServerConfig;

interface McpConnection {
  name: string;
  client: Client;
  transport: { close(): Promise<void> };
}

const connections: McpConnection[] = [];

async function connectToHttpServer(config: McpHttpServerConfig) {
  const transport = new StreamableHTTPClientTransport(new URL(config.url));

  const client = new Client(
    { name: "kt-killer", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  connections.push({ name: config.name, client, transport });

  return { client, serverName: config.name };
}

async function connectToStdioServer(config: McpStdioServerConfig) {
  // Dynamic import — StdioClientTransport uses Node child_process,
  // which doesn't exist on Vercel's edge/serverless runtime.
  // By importing dynamically, the HTTP path never loads this module.
  const { StdioClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/stdio.js"
  );

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: {
      ...(process.env as Record<string, string>),
      ...(config.env ?? {}),
    },
  });

  const client = new Client(
    { name: "kt-killer", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  connections.push({ name: config.name, client, transport });

  return { client, serverName: config.name };
}

// Wraps MCP tools as AI SDK tools — same logic regardless of transport.
function wrapMcpTools(
  client: Client,
  serverName: string,
  mcpTools: any[]
): Record<string, any> {
  const aiTools: Record<string, any> = {};

  for (const mcpTool of mcpTools) {
    const toolName = mcpTool.name;

    aiTools[`${serverName}__${toolName}`] = tool({
      description: `[${serverName}] ${mcpTool.description ?? toolName}`,
      inputSchema: jsonSchema(mcpTool.inputSchema as any),
      execute: async (args: any) => {
        const result = await client.callTool({
          name: toolName,
          arguments: args,
        });

        const textParts = (result.content as any[])
          ?.filter((c: any) => c.type === "text")
          .map((c: any) => c.text);

        return textParts?.join("\n") ?? "No response from tool.";
      },
    });
  }

  return aiTools;
}

async function connectToServer(config: McpServerConfig) {
  const { client, serverName } =
    config.transport === "http"
      ? await connectToHttpServer(config)
      : await connectToStdioServer(config);

  const { tools: mcpTools } = await client.listTools();
  return wrapMcpTools(client, serverName, mcpTools);
}

export async function discoverMcpTools(
  configs: McpServerConfig[]
): Promise<Record<string, any>> {
  const allTools: Record<string, any> = {};

  for (const config of configs) {
    try {
      const tools = await connectToServer(config);
      Object.assign(allTools, tools);
    } catch (error) {
      console.error(`Failed to connect to MCP server "${config.name}":`, error);
    }
  }

  return allTools;
}

export async function disconnectAll() {
  for (const conn of connections) {
    try {
      await conn.transport.close();
    } catch {}
  }
  connections.length = 0;
}
