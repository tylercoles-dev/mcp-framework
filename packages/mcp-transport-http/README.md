# @tylercoles/mcp-transport-http

HTTP transport with Server-Sent Events (SSE) support for MCP servers. This transport provides a full-featured HTTP server with session management, authentication integration, and support for the latest MCP Streamable HTTP specification.

## Features

- 🌐 **Modern HTTP Transport** - Implements MCP Streamable HTTP (2025-06-18)
- 🔒 **Authentication Ready** - Seamless integration with auth providers
- 📡 **Server-Sent Events** - Real-time server-to-client communication
- 🛡️ **Security Built-in** - DNS rebinding protection, CORS, Helmet
- ⚡ **Session Management** - Stateful sessions with unique session IDs
- 🔧 **Express Integration** - Full Express.js compatibility for custom routes

## Installation

```bash
npm install @tylercoles/mcp-transport-http
```

## Quick Start

```typescript
import { MCPServer } from '@tylercoles/mcp-server';
import { HttpTransport } from '@tylercoles/mcp-transport-http';

const server = new MCPServer({
  name: 'my-mcp-server',
  version: '1.0.0'
});

// Add some tools
server.registerTool('hello', {
  description: 'Say hello',
  inputSchema: { name: z.string() }
}, async ({ name }) => ({
  content: [{ type: 'text', text: `Hello, ${name}!` }]
}));

// Create HTTP transport
const transport = new HttpTransport({
  port: 3000,
  host: '127.0.0.1'
});

server.useTransport(transport);
await server.start();

console.log('MCP server running on http://127.0.0.1:3000/mcp');
```

## Configuration

### Basic Configuration

```typescript
const transport = new HttpTransport({
  port: 3000,                              // Port to listen on
  host: '127.0.0.1',                       // Host to bind to
  basePath: '/mcp',                        // Base path for MCP endpoints
  trustProxy: false,                       // Trust proxy headers
  externalDomain: 'https://mcp.example.com' // External domain for OAuth
});
```

### Security Configuration

```typescript
const transport = new HttpTransport({
  port: 3000,
  enableDnsRebindingProtection: true,      // Prevent DNS rebinding attacks
  allowedHosts: ['127.0.0.1', 'localhost'], // Allowed hosts
  helmetOptions: {                         // Helmet security headers
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  }
});
```

### CORS Configuration

```typescript
const transport = new HttpTransport({
  port: 3000,
  cors: {
    origin: ['https://claude.ai', 'https://example.com'],
    credentials: true,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'mcp-session-id']
  }
});
```

### Authentication Integration

```typescript
import { DevAuth } from '@tylercoles/mcp-auth';

const transport = new HttpTransport({
  port: 3000,
  auth: new DevAuth({
    id: 'dev-user',
    username: 'developer',
    email: 'dev@example.com'
  })
});
```

## MCP Streamable HTTP Protocol

This transport implements the latest MCP Streamable HTTP specification:

### Endpoints

- `POST /mcp` - Client-to-server messages (requests, responses, notifications)
- `GET /mcp` - Server-sent events stream for server-to-client messages
- `DELETE /mcp` - Session termination
- `GET /health` - Health check endpoint

### Session Management

```typescript
// Sessions are automatically managed
// Client receives session ID in Mcp-Session-Id header
// All subsequent requests must include this header

// Example client request:
POST /mcp
Content-Type: application/json
Mcp-Session-Id: 550e8400-e29b-41d4-a716-446655440000

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

### Server-Sent Events

For real-time server-to-client communication:

```typescript
// Client opens SSE connection
GET /mcp
Accept: text/event-stream
Mcp-Session-Id: 550e8400-e29b-41d4-a716-446655440000

// Server sends events
data: {"jsonrpc":"2.0","method":"notifications/tools/list_changed"}

data: {"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}
```

## Express Integration

Access the underlying Express app for custom routes:

```typescript
const transport = new HttpTransport({ port: 3000 });
await transport.start(server);

const app = transport.getApp();
if (app) {
  // Add custom routes
  app.get('/custom', (req, res) => {
    res.json({ message: 'Custom endpoint' });
  });
  
  // Add middleware
  app.use('/api', express.json());
}
```

### Router Registration

Register routers with optional authentication:

```typescript
// Public router
const publicRouter = transport.createRouter(false);
publicRouter.get('/status', (req, res) => {
  res.json({ status: 'ok' });
});
transport.registerRouter('/api/public', publicRouter);

// Protected router (requires auth)
const protectedRouter = transport.createRouter(true);
protectedRouter.get('/user-data', (req, res) => {
  const user = transport.getAuthenticatedUser(req);
  res.json({ user });
});
transport.registerRouter('/api/protected', protectedRouter);
```

## Authentication Middleware

### Built-in Auth Support

```typescript
import { BearerTokenAuth } from '@tylercoles/mcp-auth';

class APIKeyAuth extends BearerTokenAuth {
  async verifyToken(token: string) {
    // Verify against your API key database
    return await getUserByApiKey(token);
  }
}

const transport = new HttpTransport({
  port: 3000,
  auth: new APIKeyAuth()
});
```

### Manual Auth Middleware

```typescript
const authMiddleware = transport.getAuthMiddleware();
if (authMiddleware) {
  app.use('/protected', authMiddleware);
}

// Or check authentication manually
app.get('/api/user', (req, res) => {
  const user = transport.getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ user });
});
```

## Health Monitoring

Built-in health endpoint:

```typescript
// GET /health
{
  "status": "ok",
  "transport": "streamableHttp",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "sessions": 3
}
```

Monitor server status:

```typescript
const sessionCount = transport.getSessionCount();
const port = transport.getPort();
console.log(`Server running on port ${port} with ${sessionCount} active sessions`);
```

## Error Handling

### HTTP Errors

```typescript
// 401 Unauthorized - Authentication required
{
  "error": "Authentication required"
}

// 400 Bad Request - Invalid MCP message
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "Invalid Request"
  },
  "id": null
}

// 500 Internal Server Error - Server error
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal server error"
  },
  "id": 1
}
```

### Connection Errors

```typescript
transport.on('error', (error) => {
  console.error('Transport error:', error);
});

transport.on('session_error', (sessionId, error) => {
  console.error(`Session ${sessionId} error:`, error);
});
```

## Advanced Usage

### Custom Session Management

```typescript
const transport = new HttpTransport({
  port: 3000,
  sessionConfig: {
    secret: 'custom-session-secret',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true,                 // HTTPS only
    sameSite: 'strict'           // CSRF protection
  }
});
```

### Multi-Transport Setup

```typescript
// Run multiple transports on different ports
const httpTransport = new HttpTransport({ port: 3000 });
const stdioTransport = new StdioTransport();

server.useTransports(httpTransport, stdioTransport);
await server.start();
```

### WebSocket Alternative

For environments requiring WebSocket-like behavior:

```typescript
// Client keeps SSE connection open
const eventSource = new EventSource('/mcp', {
  headers: { 'Mcp-Session-Id': sessionId }
});

eventSource.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleServerMessage(message);
};

// Send messages via POST
fetch('/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Mcp-Session-Id': sessionId
  },
  body: JSON.stringify(mcpRequest)
});
```

## Security Considerations

### DNS Rebinding Protection

```typescript
const transport = new HttpTransport({
  port: 3000,
  enableDnsRebindingProtection: true,
  allowedHosts: ['127.0.0.1', 'localhost', 'mcp.example.com']
});
```

### CORS Security

```typescript
const transport = new HttpTransport({
  port: 3000,
  cors: {
    origin: (origin, callback) => {
      // Custom origin validation
      const allowed = ['https://claude.ai', 'https://app.example.com'];
      callback(null, allowed.includes(origin || ''));
    },
    credentials: true
  }
});
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const transport = new HttpTransport({ port: 3000 });
await transport.start(server);

const app = transport.getApp();
if (app) {
  app.use('/mcp', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100                   // limit each IP to 100 requests per windowMs
  }));
}
```

## Performance Optimization

### Connection Pooling

```typescript
// Keep SSE connections alive
const transport = new HttpTransport({
  port: 3000,
  keepAliveTimeout: 30000,    // 30 seconds
  headersTimeout: 35000       // 35 seconds
});
```

### Compression

```typescript
import compression from 'compression';

const app = transport.getApp();
if (app) {
  app.use(compression());
}
```

## Debugging

### Enable Debug Logging

```typescript
process.env.DEBUG = 'mcp-transport-http:*';

const transport = new HttpTransport({
  port: 3000,
  // Debug mode provides verbose logging
});
```

### Request Logging

```typescript
import morgan from 'morgan';

const app = transport.getApp();
if (app) {
  app.use(morgan('combined'));
}
```

## Compatibility

- **MCP Protocol**: 2025-06-18 (Streamable HTTP)
- **Node.js**: 18.0.0+
- **Express**: 4.x
- **TypeScript**: 5.x

## Migration from SSE Transport

If migrating from the legacy SSE transport:

```typescript
// Old SSE transport
import { SSETransport } from '@tylercoles/mcp-transport-sse';

// New HTTP transport (drop-in replacement)
import { HttpTransport } from '@tylercoles/mcp-transport-http';

// Configuration is similar
const transport = new HttpTransport({
  port: 3000,
  // Same configuration options
});
```

## License

MIT
