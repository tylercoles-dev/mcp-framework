# @tylercoles/mcp-framework

A modular framework for building Model Context Protocol (MCP) servers with pluggable transports and authentication providers.

## Overview

This framework extracts the core MCP server infrastructure into reusable packages, allowing developers to:

1. **Implement only their specific tools/features** - Focus on your domain logic
2. **Choose transport type** - stdio for local development, HTTP for production
3. **Configure auth providers** - Built-in support for OAuth providers like Authentik
4. **Automatic OAuth handling** - Framework manages discovery endpoints, client registration, and auth flows

## Packages

### Core Packages

- **[@tylercoles/mcp-server](./packages/mcp-server)** - Core MCP server framework with plugin architecture
- **[@tylercoles/mcp-auth](./packages/mcp-auth)** - Authentication abstractions and base implementations

### Transport Packages

- **[@tylercoles/mcp-transport-stdio](./packages/mcp-transport-stdio)** - stdio transport for local/CLI usage
- **[@tylercoles/mcp-transport-http](./packages/mcp-transport-http)** - HTTP transport with session management
- **[@tylercoles/mcp-transport-sse](./packages/mcp-transport-sse)** - SSE (Server-Sent Events) transport for backwards compatibility

### Auth Provider Packages

- **[@tylercoles/mcp-auth-authentik](./packages/mcp-auth-authentik)** - Authentik OAuth provider
- **@tylercoles/mcp-auth-auth0** (coming soon) - Auth0 provider

## Quick Start

### Installation

```bash
npm install @tylercoles/mcp-server @tylercoles/mcp-transport-stdio
```

### Basic Example

```typescript
import { MCPServer, z } from '@tylercoles/mcp-server';
import { StdioTransport } from '@tylercoles/mcp-transport-stdio';

// Create server
const server = new MCPServer({
  name: 'my-server',
  version: '1.0.0'
});

// Register a tool
server.registerTool(
  'greet',
  {
    description: 'Greet someone',
    inputSchema: { name: z.string() }
  },
  async ({ name }) => ({
    content: [{ type: 'text', text: `Hello, ${name}!` }]
  })
);

// Use stdio transport
server.useTransport(new StdioTransport());

// Start server
await server.start();
```

### Multiple Transports

Run a single server accessible via multiple transports:

```typescript
import { MCPServer } from '@tylercoles/mcp-server';
import { HttpTransport } from '@tylercoles/mcp-transport-http';
import { StdioTransport } from '@tylercoles/mcp-transport-stdio';

const server = new MCPServer({
  name: 'multi-transport-server',
  version: '1.0.0'
});

// Register your tools once
server.registerTool('my-tool', config, handler);

// Add multiple transports
server.useTransports(
  new HttpTransport({ port: 3000 }),
  new StdioTransport()
);

// Or add them individually
// server.useTransport(new HttpTransport({ port: 3000 }));
// server.useTransport(new StdioTransport());

await server.start();
```

### HTTP with Authentication

```typescript
import { MCPServer } from '@tylercoles/mcp-server';
import { HttpTransport } from '@tylercoles/mcp-transport-http';
import { AuthentikAuth } from '@tylercoles/mcp-auth-authentik';

const server = new MCPServer({
  name: 'secure-server',
  version: '1.0.0'
});

// Configure HTTP transport with auth
const transport = new HttpTransport({
  port: 3000,
  auth: new AuthentikAuth({
    url: 'https://auth.example.com',
    clientId: 'my-app'
  })
});

server.useTransport(transport);
await server.start();
```

### Custom Routes with Authentication

The HTTP transport supports easy router registration with built-in auth:

```typescript
// Create a public router (no auth)
const publicRouter = transport.createRouter(false);
publicRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
transport.registerRouter('/public', publicRouter);

// Create a protected router (auth required)
const apiRouter = transport.createRouter(true);
apiRouter.get('/data', (req, res) => {
  const user = transport.getAuthenticatedUser(req);
  res.json({ user: user?.username, data: [...] });
});
transport.registerRouter('/api', apiRouter);
```

### Server Introspection

Query server capabilities at runtime:

```typescript
// Get all registered tools
const tools = server.getTools();
tools.forEach(tool => {
  console.log(`Tool: ${tool.name} - ${tool.description}`);
});

// Get specific tool info
const tool = server.getTool('my-tool');

// Get all capabilities
const capabilities = server.getCapabilities();
console.log(`Tools: ${capabilities.tools.length}`);
console.log(`Resources: ${capabilities.resources.length}`);
console.log(`Prompts: ${capabilities.prompts.length}`);

// Also available: getResources(), getResource(), getPrompts(), getPrompt()
```

## Examples

- [Echo Server](./examples/echo-server) - Simple server demonstrating basic features
- [Multi-Transport Server](./examples/multi-transport-server) - Server with both HTTP and stdio transports
- [Memory Server](./examples/memory-server) - Full-featured server with NATS persistence
- More examples coming soon...

## Development

This project uses **npm workspaces** for monorepo management. To work on the packages:

```bash
# Install dependencies (npm 7+ required)
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Watch mode for development
npm run dev

# Verify workspace setup
npm run verify
```

### Working with Workspaces

```bash
# Run command in specific package
npm run build -w @tylercoles/mcp-server

# Install dependency in specific package
npm install express -w @tylercoles/mcp-transport-http

# Run all workspace commands
npm run build --workspaces
```

See [Workspace Guide](./docs/workspace-guide.md) for detailed information.

## Architecture

The framework follows a plugin architecture:

```
┌─────────────────┐
│   MCP Server    │  Core framework
├─────────────────┤
│    Transport    │  Pluggable (stdio, HTTP, etc.)
├─────────────────┤
│      Auth       │  Optional auth providers
├─────────────────┤
│   Your Tools    │  Domain-specific implementation
└─────────────────┘
```

### Key Concepts

- **Transport Independence**: Write your tools once, run with any transport
- **Multi-Transport Support**: Run multiple transports simultaneously on one server
- **Context Injection**: Access user info and request metadata in tool handlers
- **Type Safety**: Full TypeScript support with Zod schema validation
- **Extensibility**: Easy to add new transports and auth providers
- **Introspection**: Query server capabilities at runtime

## Migration from Standalone Servers

If you have an existing MCP server, migration is straightforward:

1. Replace direct SDK usage with `MCPServer` class
2. Move transport setup to use transport packages
3. Add authentication if needed

See the [migration guide](./docs/MIGRATION_STRATEGY.md) for detailed steps.

## Contributing

Contributions are welcome! Please see our [contributing guidelines](./CONTRIBUTING.md).

## License

MIT © Tyler Coles

## Related

- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
