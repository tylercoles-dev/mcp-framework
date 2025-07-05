# Echo Server Example

A simple example demonstrating how to use the `@tylercoles/mcp-server` framework to create an MCP server with different transport options.

## Features

- Simple echo tool that returns messages
- Statistics tool for analyzing text
- Configurable transport (stdio or HTTP)
- Optional authentication in HTTP mode
- Example of error handling and context usage

## Running the Examples

### Prerequisites

First, build all packages from the root directory:
```bash
npm run build
```

Then navigate to this example:
```bash
cd examples/echo-server
npm install
npm run build
```

### stdio Transport (Default)

Run the server using stdio transport (for use with MCP clients):

```bash
npm start
# or
npm run start:stdio
```

Debug mode (logs to stderr):
```bash
DEBUG=true npm start
```

### HTTP Transport

Run the server using HTTP transport:

```bash
npm run start:http
# or
TRANSPORT=http npm start
```

Configure the port:
```bash
TRANSPORT=http PORT=8080 npm start
```

Disable authentication:
```bash
TRANSPORT=http USE_AUTH=false npm start
```

### OAuth Transport (Authentik)

Run the server with full OAuth authentication:

```bash
# Configure Authentik
AUTHENTIK_URL=https://auth.example.com CLIENT_ID=echo-server npm run start:oauth

# With custom port
PORT=8080 AUTHENTIK_URL=https://auth.example.com CLIENT_ID=echo-server npm run start:oauth
```

The framework automatically provides:
- OAuth discovery endpoints (`/.well-known/oauth-protected-resource`)
- Authorization server metadata (`/.well-known/oauth-authorization-server`)
- Dynamic client registration (`/application/o/register/`)
- Login/logout routes (`/auth/login`, `/auth/callback`, `/auth/logout`)
- Session management
- Token validation

## Using the Server

### With stdio Transport

The stdio transport is designed to be used by MCP clients that spawn the server as a subprocess. The server communicates via stdin/stdout.

Example MCP client configuration:
```json
{
  "mcpServers": {
    "echo": {
      "command": "node",
      "args": ["path/to/echo-server/dist/index.js"]
    }
  }
}
```

### With HTTP Transport

When running with HTTP transport, the server exposes an MCP endpoint at `http://localhost:3000/mcp`.

You can test it using curl:

```bash
# Initialize session
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'

# List tools (use the session ID from the initialize response)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <session-id-from-initialize>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'
```

## Available Tools

### echo
Echoes back the provided message. In HTTP mode with auth enabled, it includes the username.

**Parameters:**
- `message` (string): Message to echo back

### echo_with_validation
Echo with message length validation (HTTP example only).

**Parameters:**
- `message` (string): Message to echo (max 100 chars)
- `uppercase` (boolean, optional): Convert to uppercase

### echo_stats
Get statistics about a message.

**Parameters:**
- `message` (string): Message to analyze

## Available Prompts

### analyze_text
A prompt template for analyzing text in detail.

**Parameters:**
- `text` (string): Text to analyze

## Available Resources

### server-info (HTTP example only)
Get information about the echo server.

**URI:** `echo://server/info`

## Code Structure

- `src/index.ts` - Main entry point with configurable transport
- `src/stdio.ts` - Simple stdio transport example
- `src/http.ts` - HTTP transport example with development auth
- `src/oauth.ts` - OAuth authentication example with Authentik
- `src/router.ts` - Router registration example with mixed auth

## Extending the Example

To add your own tools:

```typescript
server.registerTool(
  'my_tool',
  {
    title: 'My Tool',
    description: 'Description of what it does',
    inputSchema: {
      param1: z.string().describe('Parameter description'),
      param2: z.number().optional().describe('Optional parameter')
    }
  },
  async ({ param1, param2 }, context) => {
    // Access user from context if using auth
    const user = context.user;
    
    // Your tool logic here
    const result = `Processed: ${param1}`;
    
    return {
      content: [{
        type: 'text',
        text: result
      }]
    };
  }
);
```

## Environment Variables

- `TRANSPORT` - Transport type: 'stdio' (default) or 'http'
- `PORT` - HTTP server port (default: 3000)
- `USE_AUTH` - Enable auth in HTTP mode: 'true' (default) or 'false'
- `DEBUG` - Enable debug logging for stdio: 'true' or 'false'

## Router Registration Example

The `router.ts` example demonstrates the new router registration API:

```bash
npm run start:router
```

This shows how to:
- Create public routers without authentication
- Create protected routers with automatic auth
- Mix public and protected routes in one router
- Apply auth middleware manually to specific routes

Key features:
```typescript
// Easy router creation
const publicRouter = transport.createRouter(false);   // No auth
const apiRouter = transport.createRouter(true);       // Auth required

// Register after server start
transport.registerRouter('/public', publicRouter);
transport.registerRouter('/api', apiRouter);

// Get user in route handlers
const user = transport.getAuthenticatedUser(req);
```
