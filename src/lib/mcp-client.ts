// MCP Client — connects to external MCP servers and wraps their tools for the AI SDK.
//
// This is the "consumer" side of MCP. Our app:
//   1. Reads a config of MCP servers (what command to run, what args)
//   2. Spawns each server as a child process
//   3. Connects via stdio transport
//   4. Calls tools/list to discover what tools each server offers
//   5. Wraps each discovered tool as an AI SDK `tool()` so the LLM can use it
//
// The result: the LLM sees both our internal tools (searchKnowledgeBase, etc.)
// AND external tools (lookupEmployee, etc.) in a single unified tool list.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { tool } from "ai";
import { jsonSchema } from "ai";

// Config shape for an MCP server connection
export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// Holds a live connection to one MCP server
interface McpConnection {
  name: string;
  client: Client;
  transport: StdioClientTransport;
}

const connections: McpConnection[] = [];

// Connect to a single MCP server and return its discovered tools as AI SDK tools.
async function connectToServer(config: McpServerConfig) {
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: {
      ...process.env as Record<string, string>,
      ...(config.env ?? {}),
    },
  });

  const client = new Client(
    { name: "kt-killer", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  const { tools: mcpTools } = await client.listTools();

  connections.push({ name: config.name, client, transport });

  // Convert each MCP tool into an AI SDK tool.
  // The MCP tool has:
  //   - name: string
  //   - description: string
  //   - inputSchema: JSON Schema object
  //
  // We wrap it with ai's tool() so the LLM can call it. When the LLM calls it,
  // we forward the call to the MCP server via client.callTool().
  const aiTools: Record<string, ReturnType<typeof tool>> = {};

  for (const mcpTool of mcpTools) {
    const serverName = config.name;
    const toolName = mcpTool.name;

    aiTools[`${serverName}__${toolName}`] = tool({
      description: `[${serverName}] ${mcpTool.description ?? toolName}`,
      inputSchema: jsonSchema(mcpTool.inputSchema as any),
      execute: async (args: any) => {
        const result = await client.callTool({
          name: toolName,
          arguments: args,
        });

        // MCP tools return { content: [{ type: "text", text: "..." }, ...] }
        // We flatten that into a single string for the LLM.
        const textParts = (result.content as any[])
          ?.filter((c: any) => c.type === "text")
          .map((c: any) => c.text);

        return textParts?.join("\n") ?? "No response from tool.";
      },
    });
  }

  return aiTools;
}

// Connect to all configured MCP servers and return a combined tool map.
export async function discoverMcpTools(
  configs: McpServerConfig[]
): Promise<Record<string, ReturnType<typeof tool>>> {
  const allTools: Record<string, ReturnType<typeof tool>> = {};

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

// Clean up all connections on shutdown.
export async function disconnectAll() {
  for (const conn of connections) {
    try {
      await conn.transport.close();
    } catch {}
  }
  connections.length = 0;
}
