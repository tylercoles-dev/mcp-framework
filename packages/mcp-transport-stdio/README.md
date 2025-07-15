# @tylercoles/mcp-transport-stdio

Standard I/O transport implementation for MCP servers. This transport enables MCP servers to communicate via stdin/stdout, making them perfect for command-line tools, direct process communication, and integration with development environments.

## Features

- 📡 **Standard I/O Communication** - Uses stdin/stdout for MCP message exchange
- 🚀 **Zero Configuration** - Works out of the box with minimal setup
- 🛠️ **Development Friendly** - Perfect for CLI tools and development servers
- 🔧 **Process Integration** - Easy integration with subprocess spawning
- 📝 **Optional Logging** - Configurable stderr logging for debugging

## Installation

```bash
npm install @tylercoles/mcp-transport-stdio
```

## Quick Start

```typescript
import { MCPServer } from '@tylercoles/mcp-server';
import { StdioTransport } from '@tylercoles/mcp-transport-stdio';

const server = new MCPServer({
  name: 'my-cli-server',
  version: '1.0.0'
});

// Add tools
server.registerTool('echo', {
  description: 'Echo back a message',
  inputSchema: { message: z.string() }
}, async ({ message }) => ({
  content: [{ type: 'text', text: `Echo: ${message}` }]
}));

// Use stdio transport
const transport = new StdioTransport({
  logStderr: true  // Optional: enable stderr logging
});

server.useTransport(transport);
await server.start();

// Server now communicates via stdin/stdout
```

## Configuration

### Basic Configuration

```typescript
const transport = new StdioTransport({
  logStderr: false  // Disable stderr logging (default)
});
```

### Development Configuration

```typescript
const transport = new StdioTransport({
  logStderr: true   // Enable stderr logging for debugging
});
```

## How It Works

The stdio transport follows the MCP stdio specification:

### Message Format

- **Input**: JSON-RPC messages received via `stdin`
- **Output**: JSON-RPC responses sent via `stdout`
- **Logging**: Optional logging sent via `stderr`
- **Delimiter**: Each message is terminated by a newline (`\n`)

### Example Communication

```bash
# Client sends (via stdin):
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{}}}

# Server responds (via stdout):
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"my-cli-server","version":"1.0.0"}}}

# Optional stderr logging:
[StdioTransport] Server connected successfully
```

## Usage Patterns

### Command-Line Tool

Create an executable MCP server:

```typescript
#!/usr/bin/env node
import { MCPServer } from '@tylercoles/mcp-server';
import { StdioTransport } from '@tylercoles/mcp-transport-stdio';

const server = new MCPServer({
  name: 'file-manager',
  version: '1.0.0'
});

server.registerTool('list-files', {
  description: 'List files in directory',
  inputSchema: { path: z.string() }
}, async ({ path }) => {
  const files = await fs.readdir(path);
  return {
    content: [{
      type: 'text',
      text: `Files in ${path}:\n${files.join('\n')}`
    }]
  };
});

const transport = new StdioTransport();
server.useTransport(transport);
await server.start();
```

Make it executable:

```bash
chmod +x ./file-manager.js
```

### Process Spawning

Launch MCP server as subprocess:

```typescript
import { spawn } from 'child_process';

const serverProcess = spawn('node', ['./mcp-server.js'], {
  stdio: ['pipe', 'pipe', 'inherit']  // stdin, stdout, stderr
});

// Send MCP messages
const initMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {} }
};

serverProcess.stdin.write(JSON.stringify(initMessage) + '\n');

// Receive responses
serverProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(Boolean);
  lines.forEach(line => {
    try {
      const message = JSON.parse(line);
      console.log('Received:', message);
    } catch (error) {
      console.error('Parse error:', error);
    }
  });
});
```

### Development Server

Combine with HTTP transport for dual-mode operation:

```typescript
const server = new MCPServer({
  name: 'dual-mode-server',
  version: '1.0.0'
});

// Use different transports based on environment
if (process.argv.includes('--stdio')) {
  server.useTransport(new StdioTransport({ logStderr: true }));
} else {
  server.useTransport(new HttpTransport({ port: 3000 }));
}

await server.start();
```

Run in different modes:

```bash
# Stdio mode
node server.js --stdio

# HTTP mode  
node server.js
```

## Integration Examples

### Claude Desktop Integration

For Claude Desktop configuration:

```json
{
  "mcpServers": {
    "file-manager": {
      "command": "node",
      "args": ["./file-manager.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### VS Code Extension

Integrate with VS Code extension:

```typescript
// extension.ts
import * as vscode from 'vscode';
import { spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  const serverPath = path.join(context.extensionPath, 'server.js');
  
  const serverProcess = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'inherit']
  });
  
  // Register command to interact with MCP server
  const disposable = vscode.commands.registerCommand('mcp.executeCommand', async () => {
    const input = await vscode.window.showInputBox();
    if (input) {
      const message = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: 'process-text', arguments: { text: input } }
      };
      
      serverProcess.stdin.write(JSON.stringify(message) + '\n');
    }
  });
  
  context.subscriptions.push(disposable);
}
```

### Shell Script Integration

Use with shell scripts:

```bash
#!/bin/bash

# Start MCP server in background
node mcp-server.js &
SERVER_PID=$!

# Function to send MCP messages
send_mcp_message() {
  local method=$1
  local params=$2
  
  echo '{"jsonrpc":"2.0","id":1,"method":"'$method'","params":'$params'}' | \
  while IFS= read -r line; do
    echo "$line" >&3
  done
}

# Setup file descriptors
exec 3> >(cat > /proc/$SERVER_PID/fd/0)  # stdin to server
exec 4< <(cat /proc/$SERVER_PID/fd/1)    # stdout from server

# Send initialize message
send_mcp_message "initialize" '{"protocolVersion":"2025-06-18","capabilities":{}}'

# Read response
read -u 4 response
echo "Server response: $response"

# Cleanup
kill $SERVER_PID
```

## Error Handling

### Connection Errors

```typescript
const transport = new StdioTransport();

try {
  await transport.start(server);
} catch (error) {
  console.error('Failed to start stdio transport:', error);
  process.exit(1);
}
```

### Message Parsing Errors

```typescript
// Stdio transport handles malformed JSON gracefully
// Invalid messages are logged to stderr if enabled
const transport = new StdioTransport({ logStderr: true });
```

### Process Termination

```typescript
process.on('SIGINT', async () => {
  console.error('Shutting down...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Terminating...');
  await server.stop();
  process.exit(0);
});
```

## Debugging

### Enable Stderr Logging

```typescript
const transport = new StdioTransport({
  logStderr: true  // Logs connection status and errors
});
```

### Message Tracing

```typescript
// Add message logging for debugging
const originalWrite = process.stdout.write;
process.stdout.write = function(chunk: any, ...args: any[]) {
  console.error('OUT:', chunk.toString().trim());
  return originalWrite.call(this, chunk, ...args);
};

process.stdin.on('data', (chunk) => {
  console.error('IN:', chunk.toString().trim());
});
```

### Debug with VS Code

Launch configuration for debugging:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug MCP Server",
  "program": "${workspaceFolder}/server.js",
  "console": "integratedTerminal",
  "env": {
    "NODE_ENV": "development"
  }
}
```

## Performance Considerations

### Buffering

Stdio transport handles message buffering automatically:

```typescript
// Large messages are handled efficiently
const largeResponse = {
  content: [{
    type: 'text',
    text: 'Very large text content...'  // No size limits
  }]
};
```

### Memory Usage

```typescript
// Monitor memory usage for long-running servers
setInterval(() => {
  const usage = process.memoryUsage();
  console.error(`Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
}, 60000);  // Every minute
```

## Testing

### Unit Testing

```typescript
import { StdioTransport } from '@tylercoles/mcp-transport-stdio';

describe('StdioTransport', () => {
  it('should start successfully', async () => {
    const transport = new StdioTransport();
    const mockServer = { getSDKServer: () => ({ connect: jest.fn() }) };
    
    await expect(transport.start(mockServer)).resolves.toBeUndefined();
  });
});
```

### Integration Testing

```typescript
import { spawn } from 'child_process';

describe('Server Integration', () => {
  it('should handle stdio communication', (done) => {
    const server = spawn('node', ['test-server.js']);
    
    // Send init message
    const initMsg = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {} }
    };
    
    server.stdin.write(JSON.stringify(initMsg) + '\n');
    
    // Expect response
    server.stdout.once('data', (data) => {
      const response = JSON.parse(data.toString());
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      done();
    });
  });
});
```

## Best Practices

1. **Error Handling**: Always handle process termination signals
2. **Logging**: Use stderr for debugging, never stdout
3. **Message Format**: Ensure JSON messages end with newlines
4. **Resource Cleanup**: Properly close streams on shutdown
5. **Testing**: Test with actual subprocess spawning

## Compatibility

- **MCP Protocol**: 2025-06-18 (stdio transport)
- **Node.js**: 18.0.0+
- **Operating Systems**: Windows, macOS, Linux
- **Shells**: bash, zsh, cmd, PowerShell

## Common Use Cases

- ✅ Claude Desktop integration
- ✅ Command-line MCP servers
- ✅ Development and testing
- ✅ VS Code extensions
- ✅ Shell script integration
- ✅ Subprocess communication
- ❌ Web browsers (use HTTP transport)
- ❌ Remote servers (use HTTP transport)

## License

MIT
