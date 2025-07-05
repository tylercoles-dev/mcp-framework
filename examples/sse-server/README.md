# SSE Server Example

An example MCP server that demonstrates using the SSE (Server-Sent Events) transport with optional stdio support.

## Features

- Configurable transport (SSE or stdio)
- Example tools (echo, calculator)
- Example resource (current time)
- Example prompt (multilingual greetings)
- Graceful shutdown handling

## Installation

```bash
npm install
npm run build
```

## Usage

### SSE Transport (default)

```bash
npm start
# or
node dist/index.js
```

The server will start on http://127.0.0.1:3000 with the following endpoints:
- SSE stream: http://127.0.0.1:3000/sse
- Messages: http://127.0.0.1:3000/messages
- Health: http://127.0.0.1:3000/health

### Stdio Transport

```bash
npm run start:stdio
# or
node dist/index.js --stdio
# or
MCP_TRANSPORT=stdio node dist/index.js
```

### Custom Configuration

```bash
# Custom port and host for SSE
PORT=8080 HOST=0.0.0.0 npm start

# Force stdio mode
MCP_TRANSPORT=stdio npm start
```

## Available Tools

1. **echo** - Echoes back any message
   ```json
   {
     "name": "echo",
     "arguments": {
       "message": "Hello, world!"
     }
   }
   ```

2. **calculate** - Performs arithmetic operations
   ```json
   {
     "name": "calculate",
     "arguments": {
       "operation": "add",
       "a": 10,
       "b": 5
     }
   }
   ```

## Available Resources

1. **time://current** - Returns the current date and time

## Available Prompts

1. **greet** - Generates a greeting in different languages
   ```json
   {
     "name": "greet",
     "arguments": {
       "name": "Alice",
       "language": "spanish"
     }
   }
   ```

## Testing with MCP Inspector

You can test this server using the MCP Inspector:

1. For SSE mode:
   ```bash
   npx @modelcontextprotocol/inspector http://127.0.0.1:3000/sse
   ```

2. For stdio mode:
   ```bash
   npx @modelcontextprotocol/inspector node dist/index.js --stdio
   ```
