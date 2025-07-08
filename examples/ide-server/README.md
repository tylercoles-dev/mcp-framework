# MCP IDE Server Example

An enhanced MCP server that provides project management and git tools, with optional integration with Serena IDE functionality.

## Features

### Core IDE Tools
- **Project Management**: Create projects with proper structure for Node.js, Python, React, Next.js
- **Workspace Setup**: Configure VS Code, Prettier, .gitignore, and other dev tools
- **Dependency Management**: Handle npm, pip, cargo dependencies
- **Git Operations**: Clone, commit, status, branch management

### Serena Integration
- **Optional Integration**: Connect to Serena IDE for advanced code analysis
- **Dual Transport**: Support both stdio and HTTP connections to Serena
- **Tool Proxying**: Automatically expose Serena tools through the MCP interface
- **Connection Management**: Graceful handling of Serena connectivity

## Installation

```bash
npm install
npm run build
```

## Usage

### Basic Usage (No Serena)

```bash
# Start with stdio transport (default)
npm start

# Start with HTTP transport  
npm run start:http
```

### With Serena Integration

#### Via stdio:
```bash
# Enable Serena via stdio (default)
npm run start:serena

# Custom Serena command
SERENA_COMMAND=serena SERENA_ARGS="--mcp-stdio --project /path/to/project" npm run start:serena
```

#### Via HTTP:
```bash
# Enable Serena via HTTP
npm run start:serena-http

# Custom Serena URL
SERENA_URL=http://localhost:3001/mcp npm run start:serena-http
```

### All Available Scripts:
```bash
npm run start              # Basic stdio transport
npm run start:serena       # With Serena via stdio
npm run start:serena-http  # With Serena via HTTP
npm run start:http         # HTTP transport (no Serena)
npm run start:http-serena  # HTTP transport + Serena
npm run start:debug        # With debug logging
```

### Environment Variables

- `SERENA_ENABLED=true` - Enable Serena integration
- `SERENA_TRANSPORT=http|stdio` - Choose transport type
- `SERENA_COMMAND=serena` - Command to run for stdio transport
- `SERENA_ARGS="--mcp-stdio"` - Arguments for stdio command
- `SERENA_URL=http://localhost:3000/mcp` - URL for HTTP transport
- `SERENA_HEADERS={"Authorization":"Bearer token"}` - JSON headers for HTTP
- `PORT=3000` - Port for HTTP transport (when using --http)
- `HOST=127.0.0.1` - Host for HTTP transport
- `DEBUG=true` - Enable debug logging

## Available Tools

### Project Management
- `create_project` - Create new projects with proper structure
- `setup_workspace` - Configure development environment
- `manage_dependencies` - Add/remove/update dependencies

### Git Operations
- `git_clone` - Clone repositories with workspace setup
- `git_commit` - Stage and commit changes
- `git_status` - Get repository status

### Serena Integration
- `serena_info` - Get Serena connection status and available tools
- `serena_*` - Proxied tools from Serena (when connected)

## Examples

### Create a new Node.js project:
```json
{
  "name": "create_project",
  "arguments": {
    "name": "my-api",
    "type": "node",
    "directory": "/path/to/projects",
    "git": true,
    "dependencies": ["express", "cors"]
  }
}
```

### Check Serena integration:
```json
{
  "name": "serena_info",
  "arguments": {}
}
```

### Use Serena tools (when connected):
```json
{
  "name": "serena_find_symbol",
  "arguments": {
    "name": "MyClass",
    "type": "class"
  }
}
```

## Architecture

The IDE server uses the @tylercoles/mcp-server framework and can optionally connect to Serena as a client:

```
IDE MCP Server
    ├── Built-in Tools (project mgmt, git)
    └── Serena Client (optional)
            ├── stdio transport → Serena process
            └── HTTP transport → Serena HTTP server
```

When Serena is connected, its tools are automatically registered with the `serena_` prefix, allowing the IDE server to act as a unified interface for both built-in functionality and advanced code analysis.

## Error Handling

- Graceful degradation when Serena is unavailable
- Clear error messages for connection issues
- Automatic retry logic for transient failures
- Comprehensive logging for debugging

## License

MIT
