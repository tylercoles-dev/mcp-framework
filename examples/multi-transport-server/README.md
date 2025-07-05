# Multi-Transport Server Example

This example demonstrates how to run a single MCP server with multiple transports simultaneously.

## Overview

The multi-transport server shows how to:
- Configure both HTTP and stdio transports on the same server
- Share tools, resources, and prompts across all transports
- Use different contexts for different transports
- Provide introspection capabilities

## Running the Server

### Both Transports (Default)
```bash
npm run build
npm start
```

### HTTP Only
```bash
npm run start:http
```
The server will be available at `http://127.0.0.1:3000/mcp`

### stdio Only
```bash
npm run start:stdio
```

## Environment Variables

- `ENABLE_HTTP` - Enable HTTP transport (default: true)
- `ENABLE_STDIO` - Enable stdio transport (default: true)  
- `HTTP_PORT` - Port for HTTP transport (default: 3000)

## Testing

### Testing HTTP Transport

Using curl:
```bash
# Initialize
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.0.0","capabilities":{},"clientInfo":{"name":"test"}}}'

# List tools
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Call a tool
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_time","arguments":{"format":"human"}}}'
```

### Testing stdio Transport

```bash
# Run in stdio mode
npm run start:stdio

# Send commands via stdin
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.0.0","capabilities":{},"clientInfo":{"name":"test"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
```

## Available Tools

1. **get_time** - Get current time in various formats (iso, unix, human)
2. **list_capabilities** - List all server capabilities (tools, resources, prompts)

## Architecture Benefits

Running multiple transports provides:
- **Flexibility**: Different clients can use their preferred transport
- **Development**: Use stdio for debugging while HTTP serves production
- **Integration**: Web apps use HTTP, CLI tools use stdio
- **Monitoring**: HTTP endpoint can provide health checks and metrics
