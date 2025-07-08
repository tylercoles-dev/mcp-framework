# @tylercoles/mcp-client-stdio

MCP client for stdio transport - provides a clean TypeScript interface for communicating with stdio MCP servers.

## Installation

```bash
npm install @tylercoles/mcp-client-stdio
```

## Usage

```typescript
import { StdioMCPClient, createStdioMCPClient } from '@tylercoles/mcp-client-stdio';
import { IMCPClient } from '@tylercoles/mcp-client';

// Option 1: Create and connect manually
const client = new StdioMCPClient({
  command: 'node',
  args: ['path/to/mcp-server.js'],
  cwd: '/path/to/server/directory'
});

await client.connect();

// Option 2: Create and connect in one step
const client = await createStdioMCPClient({
  command: 'node',
  args: ['server.js']
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

The `StdioClientConfig` interface supports:

- `command` (string): Command to execute (e.g., 'node', 'python')
- `args` (string[]): Arguments to pass to the command
- `env` (Record<string, string>): Environment variables
- `cwd` (string): Working directory for the process

## API

### StdioMCPClient

- `connect()`: Connect to the MCP server
- `disconnect()`: Disconnect from the server
- `isConnected()`: Check connection status
- `listTools()`: Get all available tools
- `callTool(name, args?)`: Call a tool with arguments
- `listResources()`: Get all available resources
- `readResource(uri)`: Read a resource by URI
- `listPrompts()`: Get all available prompts
- `getPrompt(name, args?)`: Get a prompt with arguments
- `getSDKClient()`: Access the underlying SDK client

## Error Handling

The client throws errors for:
- Connection failures
- Tool call errors
- Resource read failures
- Invalid arguments

Always wrap calls in try-catch blocks for proper error handling.

## Architecture

This package extends the base `@tylercoles/mcp-client` interfaces:

```
@tylercoles/mcp-client (interfaces)
    ↑
@tylercoles/mcp-client-stdio (implementation)
```

The `StdioMCPClient` class extends `BaseMCPClient` and implements `IMCPClient`, ensuring a consistent API across all transport types.

## License

MIT
