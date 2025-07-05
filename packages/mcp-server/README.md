# @tylercoles/mcp-server

Core framework for building Model Context Protocol (MCP) servers with a clean plugin architecture supporting multiple transports.

## Features

- 🔌 **Plugin Architecture** - Easy-to-use transport system supporting stdio and StreamableHTTP
- 🛠️ **Type-Safe** - Full TypeScript support with Zod schema validation
- 🌐 **Multiple Transports** - Run the same server over different transports
- 🎯 **Context Injection** - Share context across all tool handlers
- 🔍 **Introspection** - Built-in methods to query registered tools, resources, and prompts
- 🔒 **Security** - Built-in DNS rebinding protection and CORS support

## Installation

```bash
npm install @tylercoles/mcp-server
```

## Quick Start

```typescript
import { MCPServer, createStreamableHTTP, createStdio, z } from '@tylercoles/mcp-server';

// Create server
const server = new MCPServer({
  name: 'my-server',
  version: '1.0.0'
});

// Register a tool
server.registerTool(
  'add',
  {
    title: 'Add Numbers',
    description: 'Add two numbers together',
    inputSchema: {
      a: z.number(),
      b: z.number()
    }
  },
  async ({ a, b }, context) => ({
    content: [{
      type: 'text',
      text: `${a} + ${b} = ${a + b}`
    }]
  })
);

// Configure transport
const useStdio = process.argv.includes('--stdio');

if (useStdio) {
  server.useTransport(createStdio());
} else {
  server.useTransport(createStreamableHTTP({
    port: 3000,
    host: '127.0.0.1'
  }));
}

// Start server
await server.start();
```

## Transports

### StreamableHTTP Transport

The StreamableHTTP transport provides a full-featured HTTP server with session management:

```typescript
server.useTransport(createStreamableHTTP({
  port: 3000,
  host: '127.0.0.1',
  path: '/mcp',
  sessionManagement: true,
  enableDnsRebindingProtection: true,
  cors: true,
  corsOptions: {
    origin: ['http://localhost:3000'],
    credentials: true
  }
}));
```

Features:
- Session management with unique session IDs
- Server-sent events for server-initiated messages
- DNS rebinding protection for security
- Full CORS configuration support

### stdio Transport

The stdio transport communicates via standard input/output:

```typescript
server.useTransport(createStdio({
  forwardStderr: true,
  onReady: () => console.error('Server ready'),
  onClose: () => console.error('Server closed')
}));
```

Perfect for:
- Command-line tools
- Direct process communication
- Development and testing

## Context Management

Share context across all handlers:

```typescript
// Set context
server.setContext({
  userId: 'user-123',
  environment: 'production'
});

// Access in handlers
server.registerTool(
  'get-user',
  { /* config */ },
  async (args, context) => {
    console.log(context.userId); // 'user-123'
    // ...
  }
);
```

## Tools

Register tools that LLMs can invoke:

```typescript
server.registerTool(
  'fetch-weather',
  {
    title: 'Fetch Weather',
    description: 'Get weather for a city',
    inputSchema: {
      city: z.string()
    }
  },
  async ({ city }) => {
    const weather = await fetchWeatherData(city);
    return {
      content: [{
        type: 'text',
        text: `Weather in ${city}: ${weather.temp}°C`
      }]
    };
  }
);
```

### Returning Resource Links

Tools can return references to resources:

```typescript
server.registerTool(
  'list-files',
  {
    title: 'List Files',
    description: 'List project files',
    inputSchema: {
      dir: z.string()
    }
  },
  async ({ dir }) => ({
    content: [
      { type: 'text', text: `Files in ${dir}:` },
      {
        type: 'resource_link',
        uri: `file://${dir}/README.md`,
        name: 'README.md',
        mimeType: 'text/markdown'
      }
    ]
  })
);
```

## Resources

Expose data through resources:

```typescript
server.registerResource(
  'config',
  'config://app',
  {
    title: 'App Config',
    description: 'Application configuration',
    mimeType: 'application/json'
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify(config, null, 2)
    }]
  })
);
```

## Prompts

Define reusable prompt templates:

```typescript
server.registerPrompt(
  'analyze-code',
  {
    title: 'Analyze Code',
    description: 'Analyze code for issues',
    argsSchema: {
      code: z.string(),
      language: z.string()
    }
  },
  ({ code, language }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Analyze this ${language} code:\n\n${code}`
      }
    }]
  })
);
```

## Introspection

Query registered capabilities:

```typescript
// Get all tools
const tools = server.getTools();

// Get specific tool
const tool = server.getTool('add');

// Get all capabilities
const capabilities = server.getCapabilities();
// { tools: [...], resources: [...], prompts: [...] }
```

## Error Handling

Tools can return errors:

```typescript
server.registerTool(
  'risky-operation',
  { /* config */ },
  async (args) => {
    try {
      const result = await riskyOperation();
      return {
        content: [{ type: 'text', text: result }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Operation failed: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

## Advanced Usage

### Multiple Transports

Run the same server on multiple transports:

```typescript
server.useTransports(
  createStreamableHTTP({ port: 3000 }),
  createStdio()
);
```

### Custom Session Management

```typescript
server.useTransport(createStreamableHTTP({
  sessionIdGenerator: () => generateCustomId(),
  sessionManagement: true
}));
```

### Stateless Mode

For simpler deployments without session state:

```typescript
server.useTransport(createStreamableHTTP({
  port: 3000,
  sessionManagement: false // Each request is independent
}));
```

## Security Considerations

1. **Always use DNS rebinding protection** for local servers
2. **Configure CORS appropriately** for your use case
3. **Validate all inputs** using Zod schemas
4. **Use HTTPS in production** when exposing servers publicly

## License

MIT
