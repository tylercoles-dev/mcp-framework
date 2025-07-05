# @tylercoles/mcp-transport-sse

Server-Sent Events (SSE) transport for MCP servers. This transport provides backwards compatibility with the deprecated HTTP+SSE transport from MCP protocol version 2024-11-05.

## Installation

```bash
npm install @tylercoles/mcp-transport-sse
```

## Usage

```typescript
import { MCPServer } from "@tylercoles/mcp-server";
import { createSSEServer } from "@tylercoles/mcp-transport-sse";

// Create MCP server
const server = new MCPServer({
  name: "my-server",
  version: "1.0.0"
});

// Register tools, resources, prompts...
server.registerTool("hello", {
  description: "Say hello",
  inputSchema: { name: z.string() }
}, async ({ name }) => ({
  content: [{ type: "text", text: `Hello, ${name}!` }]
}));

// Create and use SSE transport
const transport = createSSEServer(server, {
  port: 3000,
  host: "127.0.0.1",
  basePath: "/",
  cors: true
});

// Start the server
await server.start();
```

## Configuration

The SSE transport accepts the following configuration options:

- `port` (number): Port to listen on (default: 3000)
- `host` (string): Host to bind to (default: "127.0.0.1")
- `basePath` (string): Base path for endpoints (default: "/")
- `cors` (object | false): CORS configuration (default: enabled with permissive settings)
- `enableDnsRebindingProtection` (boolean): Enable DNS rebinding protection (default: true)
- `allowedHosts` (string[]): Allowed hosts for DNS rebinding protection (default: ["127.0.0.1", "localhost"])

## Endpoints

The SSE transport exposes the following endpoints:

- `GET {basePath}/sse` - SSE stream for server-to-client messages
- `POST {basePath}/messages?sessionId={id}` - Client-to-server messages
- `GET {basePath}/health` - Health check endpoint

## Security

This transport includes:
- DNS rebinding protection (enabled by default)
- CORS support
- Request size limits
- Session management

## Backwards Compatibility

This transport is designed to work with older MCP clients that expect the HTTP+SSE transport pattern. For new implementations, consider using the Streamable HTTP transport instead.

## License

MIT
