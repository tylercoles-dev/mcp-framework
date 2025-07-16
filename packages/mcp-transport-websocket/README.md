# @tylercoles/mcp-transport-websocket

WebSocket transport for real-time bidirectional MCP (Model Context Protocol) communication.

## Features

- **Real-time Communication**: Full-duplex communication using WebSocket protocol
- **Connection Management**: Automatic connection state tracking and management
- **Heartbeat System**: Built-in ping/pong heartbeat for connection health monitoring
- **Message Routing**: Flexible message routing system for custom protocol handling
- **Broadcasting**: Send messages to all connected clients simultaneously
- **Error Handling**: Comprehensive error handling with proper JSON-RPC error responses
- **Scalable**: Support for multiple concurrent connections with configurable limits
- **Secure**: Built-in message size limits and connection timeouts

## Installation

```bash
npm install @tylercoles/mcp-transport-websocket
```

## Basic Usage

### Server Setup

```typescript
import { MCPServer } from '@tylercoles/mcp-server';
import { WebSocketTransport } from '@tylercoles/mcp-transport-websocket';

// Create MCP server
const server = new MCPServer({
  name: 'my-websocket-server',
  version: '1.0.0'
});

// Create WebSocket transport
const wsTransport = new WebSocketTransport({
  port: 3000,
  path: '/mcp',
  maxConnections: 100
});

// Register tools, resources, prompts...
server.registerTool('echo', {
  description: 'Echo back the input',
  inputSchema: { message: z.string() }
}, async ({ message }) => ({
  content: [{ type: 'text', text: message }]
}));

// Use WebSocket transport
server.useTransport(wsTransport);

// Start server
await server.start();
console.log('WebSocket MCP server started on ws://localhost:3000/mcp');
```

### Client Connection

```typescript
import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:3000/mcp');

ws.on('open', () => {
  console.log('Connected to MCP server');
  
  // Send a tool call request
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: '1',
    method: 'tools/call',
    params: {
      name: 'echo',
      arguments: { message: 'Hello, WebSocket!' }
    }
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  console.log('Received:', response);
});
```

## Configuration

```typescript
interface WebSocketConfig {
  port: number;                    // Required: Port to listen on
  host?: string;                   // Host to bind to (default: '0.0.0.0')
  path?: string;                   // WebSocket path (default: '/mcp')
  maxConnections?: number;         // Max concurrent connections (default: 100)
  heartbeatInterval?: number;      // Heartbeat interval in ms (default: 30000)
  connectionTimeout?: number;      // Connection timeout in ms (default: 10000)
  messageTimeout?: number;         // Message timeout in ms (default: 30000)
  maxMessageSize?: number;         // Max message size in bytes (default: 1MB)
  enableCompression?: boolean;     // Enable compression (default: true)
  enablePerMessageDeflate?: boolean; // Enable per-message deflate (default: true)
}
```

## Advanced Features

### Custom Message Routing

```typescript
// Register custom message router
wsTransport.registerMessageRouter('custom/method', async (message, connection) => {
  // Handle custom method
  const response = {
    jsonrpc: '2.0',
    id: message.id,
    result: { handled: 'custom method' }
  };
  
  await connection.send(response);
});
```

### Broadcasting to All Clients

```typescript
// Broadcast notification to all connected clients
await wsTransport.broadcast({
  jsonrpc: '2.0',
  method: 'notifications/server_status',
  params: { status: 'maintenance_mode' }
});
```

### Connection Management

```typescript
// Get connection statistics
const stats = wsTransport.getStats();
console.log(`Active connections: ${stats.activeConnections}/${stats.maxConnections}`);

// Get all active connections
const connections = wsTransport.getConnections();

// Send message to specific connection
await wsTransport.sendToConnection(connections[0], {
  jsonrpc: '2.0',
  method: 'notifications/private_message',
  params: { message: 'Hello specific client!' }
});
```

### Connection State Monitoring

```typescript
// Monitor connection state changes
connection.onStateChange((state) => {
  console.log(`Connection state changed to: ${state}`);
  
  switch (state) {
    case ConnectionState.Connected:
      console.log('Client connected');
      break;
    case ConnectionState.Disconnected:
      console.log('Client disconnected');
      break;
    case ConnectionState.Error:
      console.log('Connection error occurred');
      break;
  }
});
```

## Protocol Support

### Heartbeat/Ping-Pong

The transport automatically handles WebSocket ping/pong frames for connection health monitoring:

```typescript
// Automatic heartbeat every 30 seconds (configurable)
const transport = new WebSocketTransport({
  port: 3000,
  heartbeatInterval: 30000 // 30 seconds
});
```

### JSON-RPC 2.0 Compliance

All messages follow JSON-RPC 2.0 specification:

```typescript
// Request
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": { "name": "echo", "arguments": { "message": "test" } }
}

// Response
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": { "content": [{ "type": "text", "text": "test" }] }
}

// Error Response
{
  "jsonrpc": "2.0",
  "id": "1",
  "error": { "code": -32602, "message": "Invalid params" }
}
```

## Error Handling

The transport provides comprehensive error handling:

```typescript
// Message size limit exceeded
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": -32700,
    "message": "Message too large: 2000000 bytes > 1048576 bytes"
  }
}

// Parse error
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": -32700,
    "message": "Parse error"
  }
}
```

## Security Considerations

- **Message Size Limits**: Configurable maximum message size to prevent DoS attacks
- **Connection Limits**: Maximum concurrent connections to manage server resources
- **Timeouts**: Connection and message timeouts to prevent resource exhaustion
- **Validation**: All incoming messages are validated for JSON-RPC compliance

## Integration with Other Transports

Use WebSocket transport alongside other transports:

```typescript
import { HttpTransport } from '@tylercoles/mcp-transport-http';
import { StdioTransport } from '@tylercoles/mcp-transport-stdio';

const server = new MCPServer({ name: 'multi-transport-server', version: '1.0.0' });

// Multiple transports
server.useTransports(
  new WebSocketTransport({ port: 3000 }),
  new HttpTransport({ port: 3001 }),
  new StdioTransport()
);

await server.start();
```

## License

MIT © Tyler Coles