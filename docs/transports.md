# Transport Guide

This guide covers the different transport options available in the MCP Framework and how to choose and configure them for your use case.

## Overview

Transports define how MCP clients and servers communicate. The framework provides multiple transport implementations, each optimized for different use cases.

## Available Transports

### stdio Transport

**Best for**: Local development, CLI tools, desktop applications

```bash
npm install @tylercoles/mcp-transport-stdio
```

```typescript
import { StdioTransport } from '@tylercoles/mcp-transport-stdio';

const stdioTransport = new StdioTransport();
server.useTransport(stdioTransport);
```

**Characteristics**:
- Process-to-process communication via stdin/stdout
- No network overhead
- Perfect for local development
- Automatic process lifecycle management

### HTTP Transport

**Best for**: Web applications, REST APIs, production deployments

```bash
npm install @tylercoles/mcp-transport-http
```

```typescript
import { HttpTransport } from '@tylercoles/mcp-transport-http';

const httpTransport = new HttpTransport({
  port: 3000,
  cors: {
    origin: ['https://your-frontend.com'],
    credentials: true
  }
});

server.useTransport(httpTransport);
```

**Characteristics**:
- REST API interface
- Session management
- Authentication support
- CORS configuration
- Rate limiting
- Middleware support

### WebSocket Transport

**Best for**: Real-time applications, streaming data, interactive tools

```bash
npm install @tylercoles/mcp-transport-websocket
```

```typescript
import { WebSocketTransport } from '@tylercoles/mcp-transport-websocket';

const wsTransport = new WebSocketTransport({
  port: 8080,
  path: '/mcp'
});

server.useTransport(wsTransport);
```

**Characteristics**:
- Full-duplex communication
- Real-time messaging
- Lower latency than HTTP
- Connection-based

### SSE Transport

**Best for**: Server-sent events, backwards compatibility

```bash
npm install @tylercoles/mcp-transport-sse
```

```typescript
import { SSETransport } from '@tylercoles/mcp-transport-sse';

const sseTransport = new SSETransport({
  port: 3001,
  path: '/events'
});

server.useTransport(sseTransport);
```

**Characteristics**:
- Server-sent events
- One-way communication (server to client)
- HTTP-based
- Good for streaming updates

## Transport Configuration

### stdio Transport

```typescript
const stdioTransport = new StdioTransport({
  // Optional: Custom input/output streams
  input: process.stdin,
  output: process.stdout,
  
  // Optional: Buffer settings
  bufferSize: 1024 * 64, // 64KB buffer
  
  // Optional: Encoding
  encoding: 'utf8'
});
```

### HTTP Transport

```typescript
const httpTransport = new HttpTransport({
  port: 3000,
  host: '0.0.0.0',
  
  // HTTPS configuration
  httpsOptions: {
    key: fs.readFileSync('path/to/private-key.pem'),
    cert: fs.readFileSync('path/to/certificate.pem')
  },
  
  // CORS configuration
  cors: {
    origin: ['https://your-frontend.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
  },
  
  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET!,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  },
  
  // Authentication
  auth: authProvider,
  
  // Custom middleware
  middleware: [
    (req, res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    }
  ]
});
```

### WebSocket Transport

```typescript
const wsTransport = new WebSocketTransport({
  port: 8080,
  host: '0.0.0.0',
  path: '/mcp',
  
  // WebSocket server options
  wsOptions: {
    perMessageDeflate: false,
    maxPayload: 1024 * 1024, // 1MB max message size
    clientTracking: true
  },
  
  // Connection limits
  maxConnections: 100,
  
  // Ping/pong settings
  pingInterval: 30000, // 30 seconds
  pongTimeout: 5000,   // 5 seconds
  
  // Authentication
  auth: authProvider,
  
  // Origin validation
  verifyClient: (info) => {
    const origin = info.origin;
    return origin === 'https://your-frontend.com';
  }
});
```

## Multi-Transport Setup

### Running Multiple Transports

```typescript
import { MCPServer } from '@tylercoles/mcp-server';
import { StdioTransport } from '@tylercoles/mcp-transport-stdio';
import { HttpTransport } from '@tylercoles/mcp-transport-http';
import { WebSocketTransport } from '@tylercoles/mcp-transport-websocket';

const server = new MCPServer({
  name: 'multi-transport-server',
  version: '1.0.0'
});

// Add your tools once
server.addTool({
  name: 'example',
  description: 'Example tool',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string' }
    }
  }
}, async (params) => {
  return { text: `Echo: ${params.message}` };
});

// Use multiple transports
server.useTransports([
  new StdioTransport(),                    // For CLI usage
  new HttpTransport({ port: 3000 }),       // For web apps
  new WebSocketTransport({ port: 8080 })   // For real-time apps
]);

await server.start();
```

### Transport-Specific Configuration

```typescript
// Different configurations for different transports
const httpTransport = new HttpTransport({
  port: 3000,
  auth: authProvider,  // Authentication only for HTTP
  cors: {
    origin: ['https://web-app.com']
  }
});

const wsTransport = new WebSocketTransport({
  port: 8080,
  auth: authProvider,  // Same auth for WebSocket
  verifyClient: (info) => {
    // Custom verification for WebSocket
    return info.origin === 'https://web-app.com';
  }
});

const stdioTransport = new StdioTransport();
// No auth needed for local stdio

server.useTransports([httpTransport, wsTransport, stdioTransport]);
```

## Transport Selection Guide

### When to Use stdio

```typescript
// ✅ Good for:
// - Local development
// - CLI tools
// - Desktop applications
// - CI/CD pipelines
// - Direct process communication

const stdioTransport = new StdioTransport();

// Example: CLI tool
if (process.argv.includes('--cli')) {
  server.useTransport(stdioTransport);
}
```

### When to Use HTTP

```typescript
// ✅ Good for:
// - Web applications
// - REST APIs
// - Authentication required
// - Rate limiting needed
// - CORS requirements

const httpTransport = new HttpTransport({
  port: 3000,
  auth: new OIDCProvider({
    issuer: 'https://auth.example.com',
    clientId: 'web-app'
  }),
  cors: {
    origin: ['https://frontend.com']
  }
});

// Example: Web application
if (process.env.NODE_ENV === 'production') {
  server.useTransport(httpTransport);
}
```

### When to Use WebSocket

```typescript
// ✅ Good for:
// - Real-time applications
// - Interactive tools
// - Streaming data
// - Low latency requirements

const wsTransport = new WebSocketTransport({
  port: 8080,
  pingInterval: 30000
});

// Example: Real-time dashboard
server.addTool({
  name: 'stream_data',
  description: 'Stream real-time data',
  inputSchema: { type: 'object' }
}, async (params, context) => {
  // Stream data to client
  const stream = setInterval(() => {
    context.notify('data_update', {
      timestamp: Date.now(),
      data: Math.random()
    });
  }, 1000);
  
  return { text: 'Streaming started' };
});
```

### When to Use SSE

```typescript
// ✅ Good for:
// - Server-sent events
// - One-way streaming
// - Backwards compatibility
// - Simple push notifications

const sseTransport = new SSETransport({
  port: 3001,
  path: '/events'
});

// Example: Status updates
server.addResource({
  uri: 'status://server',
  name: 'Server Status'
}, async () => {
  return {
    contents: [{
      uri: 'status://server',
      mimeType: 'text/plain',
      text: 'Server is running'
    }]
  };
});
```

## Advanced Transport Features

### Custom Transport Implementation

```typescript
import { Transport } from '@tylercoles/mcp-server';

class CustomTransport implements Transport {
  name = 'custom';
  
  async start(server: MCPServer): Promise<void> {
    // Implementation
  }
  
  async stop(): Promise<void> {
    // Implementation
  }
  
  async send(message: any): Promise<void> {
    // Implementation
  }
}

// Use custom transport
server.useTransport(new CustomTransport());
```

### Transport Middleware

```typescript
// HTTP middleware
const httpTransport = new HttpTransport({
  port: 3000,
  middleware: [
    // Logging middleware
    (req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    },
    
    // Authentication middleware
    (req, res, next) => {
      if (req.path.startsWith('/protected')) {
        // Check authentication
        if (!req.session?.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }
      next();
    },
    
    // Rate limiting middleware
    (req, res, next) => {
      const ip = req.ip;
      // Implement rate limiting logic
      next();
    }
  ]
});
```

### Transport Events

```typescript
// Listen to transport events
httpTransport.on('connection', (client) => {
  console.log('New HTTP connection');
});

httpTransport.on('error', (error) => {
  console.error('HTTP transport error:', error);
});

wsTransport.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    console.log('Received:', message);
  });
});
```

## Performance Considerations

### Connection Pooling

```typescript
// HTTP transport with connection pooling
const httpTransport = new HttpTransport({
  port: 3000,
  keepAliveTimeout: 5000,
  headersTimeout: 60000,
  maxConnections: 1000
});
```

### WebSocket Connection Limits

```typescript
// WebSocket with connection management
const wsTransport = new WebSocketTransport({
  port: 8080,
  maxConnections: 100,
  pingInterval: 30000,
  pongTimeout: 5000
});
```

### Memory Management

```typescript
// Prevent memory leaks
server.onShutdown(async () => {
  await httpTransport.stop();
  await wsTransport.stop();
  await stdioTransport.stop();
});
```

## Security Considerations

### HTTPS Configuration

```typescript
const httpsOptions = {
  key: fs.readFileSync('path/to/private-key.pem'),
  cert: fs.readFileSync('path/to/certificate.pem'),
  // Optional: intermediate certificates
  ca: fs.readFileSync('path/to/ca-bundle.pem')
};

const httpTransport = new HttpTransport({
  port: 443,
  httpsOptions,
  // Force HTTPS redirect
  redirectHttpToHttps: true
});
```

### WebSocket Security

```typescript
const wsTransport = new WebSocketTransport({
  port: 8080,
  wsOptions: {
    // Verify client origin
    verifyClient: (info) => {
      const origin = info.origin;
      const allowedOrigins = ['https://your-app.com'];
      return allowedOrigins.includes(origin);
    }
  }
});
```

## Testing Transports

### HTTP Transport Testing

```typescript
import request from 'supertest';

describe('HTTP Transport', () => {
  let server: MCPServer;
  let httpTransport: HttpTransport;
  
  beforeEach(async () => {
    server = new MCPServer({
      name: 'test-server',
      version: '1.0.0'
    });
    
    httpTransport = new HttpTransport({ port: 3000 });
    server.useTransport(httpTransport);
    
    await server.start();
  });
  
  afterEach(async () => {
    await server.stop();
  });
  
  it('should handle tool requests', async () => {
    const response = await request(httpTransport.app)
      .post('/tools/example')
      .send({ message: 'test' });
    
    expect(response.status).toBe(200);
    expect(response.body.text).toContain('test');
  });
});
```

### WebSocket Transport Testing

```typescript
import WebSocket from 'ws';

describe('WebSocket Transport', () => {
  let server: MCPServer;
  let wsTransport: WebSocketTransport;
  let ws: WebSocket;
  
  beforeEach(async () => {
    server = new MCPServer({
      name: 'test-server',
      version: '1.0.0'
    });
    
    wsTransport = new WebSocketTransport({ port: 8080 });
    server.useTransport(wsTransport);
    
    await server.start();
    
    ws = new WebSocket('ws://localhost:8080');
    await new Promise((resolve) => {
      ws.on('open', resolve);
    });
  });
  
  afterEach(async () => {
    ws.close();
    await server.stop();
  });
  
  it('should handle tool requests', async () => {
    const message = {
      id: '1',
      method: 'tools/call',
      params: {
        name: 'example',
        arguments: { message: 'test' }
      }
    };
    
    ws.send(JSON.stringify(message));
    
    const response = await new Promise((resolve) => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });
    
    expect(response.id).toBe('1');
    expect(response.result.text).toContain('test');
  });
});
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find and kill process using port
   lsof -ti:3000 | xargs kill -9
   ```

2. **CORS Issues**
   ```typescript
   // Allow all origins in development
   cors: {
     origin: process.env.NODE_ENV === 'development' ? true : ['https://your-app.com']
   }
   ```

3. **WebSocket Connection Issues**
   ```typescript
   // Add connection debugging
   wsTransport.on('connection', (ws) => {
     console.log('WebSocket connected');
     
     ws.on('error', (error) => {
       console.error('WebSocket error:', error);
     });
     
     ws.on('close', (code, reason) => {
       console.log('WebSocket closed:', code, reason);
     });
   });
   ```

### Debug Mode

```typescript
// Enable debug logging
const httpTransport = new HttpTransport({
  port: 3000,
  debug: true
});
```

## Next Steps

- [Authentication Guide](authentication.md) - Add authentication to your transports
- [Tool Development](tool-development.md) - Advanced tool development
- [Deployment Guide](deployment.md) - Deploy your servers
- [Examples](../examples/) - Transport-specific examples