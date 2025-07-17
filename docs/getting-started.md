# Getting Started with MCP Framework

This guide will help you get started with the MCP Framework, from installation to creating your first MCP server.

## Installation

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher

### Basic Installation

Install the core framework and a transport:

```bash
npm install @tylercoles/mcp-server @tylercoles/mcp-transport-stdio
```

### Full Installation

For a complete setup with all transports and authentication:

```bash
npm install @tylercoles/mcp-server \
  @tylercoles/mcp-transport-stdio \
  @tylercoles/mcp-transport-http \
  @tylercoles/mcp-transport-websocket \
  @tylercoles/mcp-auth-oidc
```

## Your First MCP Server

### Hello World Example

Create a simple MCP server with a basic tool:

```typescript
import { MCPServer } from '@tylercoles/mcp-server';
import { StdioTransport } from '@tylercoles/mcp-transport-stdio';

// Create server instance
const server = new MCPServer({
  name: 'hello-world-server',
  version: '1.0.0',
  description: 'A simple hello world MCP server'
});

// Add a basic tool
server.addTool({
  name: 'hello',
  description: 'Say hello to someone',
  inputSchema: {
    type: 'object',
    properties: {
      name: { 
        type: 'string',
        description: 'The name to greet'
      }
    },
    required: ['name']
  }
}, async (params) => {
  return {
    text: `Hello, ${params.name}!`
  };
});

// Use stdio transport for local development
server.useTransport(new StdioTransport());

// Start the server
async function main() {
  try {
    await server.start();
    console.log('Server started successfully');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
```

### Running Your Server

Save the code above as `server.ts` and run:

```bash
npx ts-node server.ts
```

## Adding More Functionality

### Multiple Tools

Add multiple tools to your server:

```typescript
// Math tool
server.addTool({
  name: 'calculate',
  description: 'Perform basic calculations',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide']
      },
      a: { type: 'number' },
      b: { type: 'number' }
    },
    required: ['operation', 'a', 'b']
  }
}, async (params) => {
  const { operation, a, b } = params;
  
  let result: number;
  switch (operation) {
    case 'add': result = a + b; break;
    case 'subtract': result = a - b; break;
    case 'multiply': result = a * b; break;
    case 'divide': 
      if (b === 0) throw new Error('Division by zero');
      result = a / b; 
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  
  return {
    text: `${a} ${operation} ${b} = ${result}`,
    data: { result }
  };
});

// File system tool
server.addTool({
  name: 'list_files',
  description: 'List files in a directory',
  inputSchema: {
    type: 'object',
    properties: {
      path: { 
        type: 'string',
        description: 'Directory path to list'
      }
    },
    required: ['path']
  }
}, async (params) => {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  try {
    const files = await fs.readdir(params.path);
    return {
      text: `Files in ${params.path}:`,
      data: {
        path: params.path,
        files: files.map(file => ({
          name: file,
          path: path.join(params.path, file)
        }))
      }
    };
  } catch (error) {
    throw new Error(`Failed to list files: ${error.message}`);
  }
});
```

### Adding Resources

Resources provide access to data that can be read by MCP clients:

```typescript
// Add a resource
server.addResource({
  uri: 'config://settings',
  name: 'Server Settings',
  description: 'Current server configuration'
}, async () => {
  return {
    contents: [{
      uri: 'config://settings',
      mimeType: 'application/json',
      text: JSON.stringify({
        name: server.name,
        version: server.version,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }, null, 2)
    }]
  };
});

// Dynamic resource with parameters
server.addResource({
  uri: 'logs://recent/{level}',
  name: 'Recent Logs',
  description: 'Recent log entries by level'
}, async (uri) => {
  const match = uri.match(/logs:\/\/recent\/(.+)/);
  const level = match?.[1] || 'info';
  
  // Mock log data
  const logs = [
    { level: 'info', message: 'Server started', timestamp: new Date() },
    { level: 'warn', message: 'Memory usage high', timestamp: new Date() },
    { level: 'error', message: 'Connection failed', timestamp: new Date() }
  ].filter(log => log.level === level);
  
  return {
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(logs, null, 2)
    }]
  };
});
```

### Adding Prompts

Prompts provide reusable prompt templates:

```typescript
// Add a prompt template
server.addPrompt({
  name: 'code_review',
  description: 'Generate a code review prompt',
  arguments: [
    {
      name: 'language',
      description: 'Programming language',
      required: true
    },
    {
      name: 'code',
      description: 'Code to review',
      required: true
    }
  ]
}, async (args) => {
  return {
    messages: [
      {
        role: 'system',
        content: {
          type: 'text',
          text: `You are a senior ${args.language} developer reviewing code. Focus on best practices, security, and maintainability.`
        }
      },
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please review this ${args.language} code:\n\n\`\`\`${args.language}\n${args.code}\n\`\`\``
        }
      }
    ]
  };
});
```

## Using Different Transports

### HTTP Transport

For web applications, use the HTTP transport:

```typescript
import { HttpTransport } from '@tylercoles/mcp-transport-http';

const httpTransport = new HttpTransport({
  port: 3000,
  cors: {
    origin: ['http://localhost:3001'],
    credentials: true
  }
});

server.useTransport(httpTransport);
```

### WebSocket Transport

For real-time applications:

```typescript
import { WebSocketTransport } from '@tylercoles/mcp-transport-websocket';

const wsTransport = new WebSocketTransport({
  port: 8080,
  path: '/mcp'
});

server.useTransport(wsTransport);
```

### Multiple Transports

Run the same server on multiple transports:

```typescript
import { StdioTransport } from '@tylercoles/mcp-transport-stdio';
import { HttpTransport } from '@tylercoles/mcp-transport-http';
import { WebSocketTransport } from '@tylercoles/mcp-transport-websocket';

server.useTransports([
  new StdioTransport(),
  new HttpTransport({ port: 3000 }),
  new WebSocketTransport({ port: 8080 })
]);
```

## Error Handling

### Tool Error Handling

```typescript
server.addTool({
  name: 'divide',
  description: 'Divide two numbers',
  inputSchema: {
    type: 'object',
    properties: {
      a: { type: 'number' },
      b: { type: 'number' }
    },
    required: ['a', 'b']
  }
}, async (params) => {
  try {
    if (params.b === 0) {
      throw new Error('Division by zero is not allowed');
    }
    
    const result = params.a / params.b;
    return {
      text: `${params.a} ÷ ${params.b} = ${result}`,
      data: { result }
    };
  } catch (error) {
    // Error will be properly formatted and sent to client
    throw error;
  }
});
```

### Server Error Handling

```typescript
// Global error handler
server.onError((error, context) => {
  console.error('Server error:', error);
  console.error('Context:', context);
});

// Handle startup errors
async function main() {
  try {
    await server.start();
    console.log('Server started successfully');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
```

## Development Tips

### TypeScript Configuration

Create a `tsconfig.json` for your project:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Project Structure

Organize your project:

```
my-mcp-server/
├── src/
│   ├── index.ts          # Main server file
│   ├── tools/            # Tool implementations
│   │   ├── math.ts
│   │   └── filesystem.ts
│   ├── resources/        # Resource implementations
│   │   └── config.ts
│   └── prompts/          # Prompt templates
│       └── code-review.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Environment Configuration

Use environment variables for configuration:

```typescript
const server = new MCPServer({
  name: process.env.SERVER_NAME || 'my-server',
  version: process.env.SERVER_VERSION || '1.0.0'
});

const port = parseInt(process.env.PORT || '3000');
const httpTransport = new HttpTransport({ port });
```

## Next Steps

- [Authentication Guide](authentication.md) - Add authentication to your server
- [Transport Guide](transports.md) - Learn about different transport options
- [Tool Development](tool-development.md) - Advanced tool development
- [Deployment Guide](deployment.md) - Deploy your server to production
- [Examples](../examples/) - Check out example implementations

## Common Issues

### Port Already in Use

If you get a port already in use error:

```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 <PID>
```

### TypeScript Compilation Errors

Make sure you have the correct TypeScript version:

```bash
npm install -D typescript@^5.3.0
```

### Module Resolution Issues

If you have import issues, check your `tsconfig.json` and ensure:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

## Help and Support

- [GitHub Issues](https://github.com/tylercoles-dev/mcp-framework/issues)
- [Documentation](https://github.com/tylercoles-dev/mcp-framework/tree/main/docs)
- [Examples](https://github.com/tylercoles-dev/mcp-framework/tree/main/examples)