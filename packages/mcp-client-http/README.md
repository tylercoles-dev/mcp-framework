# @tylercoles/mcp-client-http

MCP client for StreamableHTTP transport - provides a clean TypeScript interface for communicating with HTTP MCP servers.

## Installation

```bash
npm install @tylercoles/mcp-client-http
```

## Usage

```typescript
import { HttpMCPClient, createHttpMCPClient } from '@tylercoles/mcp-client-http';
import { IMCPClient } from '@tylercoles/mcp-client';

// Option 1: Create and connect manually
const client = new HttpMCPClient({
  url: 'http://localhost:3000/mcp',
  headers: {
    'Authorization': 'Bearer token'
  },
  timeout: 30000
});

await client.connect();

// Option 2: Create and connect in one step
const client = await createHttpMCPClient({
  url: 'https://api.example.com/mcp'
});

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools.map(t => t.name));

// Call a tool
const result = await client.callTool('tool_name', {
  arg1: 'value1',
  arg2: 'value2'
});

// List and read resources
const resources = await client.listResources();
const resourceData = await client.readResource('resource://example');

// Work with prompts
const prompts = await client.listPrompts();
const prompt = await client.getPrompt('prompt_name', { arg: 'value' });

// Clean up
await client.disconnect();
```

## Configuration

The `HttpClientConfig` interface supports:

- `url` (string): URL of the MCP server endpoint
- `headers` (Record<string, string>): Custom HTTP headers
- `timeout` (number): Request timeout in milliseconds

## API

### HttpMCPClient

- `connect()`: Connect to the MCP server
- `disconnect()`: Disconnect from the server
- `isConnected()`: Check connection status
- `listTools()`: Get all available tools
- `callTool(name, args?)`: Call a tool with arguments
- `listResources()`: Get all available resources
- `readResource(uri)`: Read a resource by URI
- `listPrompts()`: Get all available prompts
- `getPrompt(name, args?)`: Get a prompt with arguments
- `getServerUrl()`: Get the server URL
- `getSDKClient()`: Access the underlying SDK client

## Authentication

For servers requiring authentication, pass the appropriate headers:

```typescript
const client = new HttpMCPClient({
  url: 'https://secure-server.com/mcp',
  headers: {
    'Authorization': 'Bearer your-token-here',
    'X-API-Key': 'your-api-key'
  }
});
```

## Error Handling

The client throws errors for:
- Connection failures
- HTTP errors (4xx, 5xx)
- Tool call errors
- Resource read failures
- Network timeouts

Always wrap calls in try-catch blocks for proper error handling.

## Architecture

This package extends the base `@tylercoles/mcp-client` interfaces:

```
@tylercoles/mcp-client (interfaces)
    ↑
@tylercoles/mcp-client-http (implementation)
```

The `HttpMCPClient` class extends `BaseMCPClient` and implements `IMCPClient`, ensuring a consistent API across all transport types.

## License

MIT
