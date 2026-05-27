#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGmailTools } from "./tools/gmail.js";

// ─────────────────────────────────────────────────────────────
// Transport: stdio (default for Claude Desktop)
// ─────────────────────────────────────────────────────────────
async function runStdio(): Promise<void> {
  const server = new McpServer({
    name: "gmail-send-mcp-server",
    version: "1.0.0",
  });
  registerGmailTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Gmail Send MCP Server running on stdio");
}

// ─────────────────────────────────────────────────────────────
// Transport: HTTP (optional, for remote use)
// Each request gets its own McpServer + transport instance
// because McpServer is stateful and can only hold one connection.
// ─────────────────────────────────────────────────────────────
async function runHTTP(): Promise<void> {
  // Loaded lazily so stdio mode (the default) doesn't pay the import cost.
  const { default: express } = await import("express");
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );

  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const server = new McpServer({
      name: "gmail-send-mcp-server",
      version: "1.0.0",
    });
    registerGmailTools(server);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT ?? "3000");
  app.listen(port, () => {
    console.error(`Gmail Send MCP Server running on http://localhost:${port}/mcp`);
  });
}

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────
const transport = process.env.TRANSPORT ?? "stdio";

if (transport === "http") {
  runHTTP().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
} else {
  runStdio().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}
