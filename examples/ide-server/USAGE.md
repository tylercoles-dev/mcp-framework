# IDE Server Usage Guide

## Quick Start

The IDE server now uses StreamableHTTP transport by default, making it more robust and compatible with web-based MCP clients.

### Starting the Server

```bash
# Navigate to the IDE server example
cd examples/ide-server

# Build if needed
npm run build

# Start with StreamableHTTP (default - port 3000)
npm start
```

### Testing with MCP Inspector

You can test the server using the MCP Inspector:

1. Install MCP Inspector: `npm install -g @modelcontextprotocol/inspector`
2. Start the IDE server: `npm start`
3. Connect inspector to: `http://localhost:3000/mcp`

### Available Endpoints

When running with StreamableHTTP:
- **MCP Endpoint**: `http://localhost:3000/mcp`
- **Health Check**: `http://localhost:3000/health`

### Testing Tools

Use these MCP requests to test the server:

#### Health Check
```json
{
  "jsonrpc": "2.0", 
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "health_check",
    "arguments": {}
  }
}
```

#### Create a Project
```json
{
  "jsonrpc": "2.0",
  "id": 2, 
  "method": "tools/call",
  "params": {
    "name": "create_project",
    "arguments": {
      "name": "test-project",
      "type": "node",
      "directory": "C:\\temp",
      "git": true
    }
  }
}
```

#### Check Serena Status
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call", 
  "params": {
    "name": "serena_info",
    "arguments": {}
  }
}
```

### Environment Variables

- `PORT=3000` - Server port (default: 3000)
- `HOST=127.0.0.1` - Server host (default: 127.0.0.1)
- `DEBUG=true` - Enable debug logging
- `SERENA_ENABLED=true` - Enable Serena integration
- `SERENA_TRANSPORT=http|stdio` - Choose Serena transport

### Troubleshooting

1. **Port in use**: Change port with `PORT=3001 npm start`
2. **Connection issues**: Check firewall settings for port 3000
3. **Serena errors**: Use `npm start` without Serena first to test basic functionality

### Compatibility

- **stdio mode**: Use `npm run start:stdio` for legacy MCP clients
- **Serena integration**: Optional, server works without it
- **Cross-platform**: Works on Windows, macOS, and Linux
