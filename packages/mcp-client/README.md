# @tylercoles/mcp-client

Base interfaces and types for MCP clients. This package provides the common interface that all MCP client implementations should follow.

## Installation

```bash
npm install @tylercoles/mcp-client
```

## Usage

This package is primarily intended for library authors creating MCP client implementations. It provides:

### Interfaces

#### `IMCPClient`
The main interface that all MCP clients must implement:

```typescript
import { IMCPClient } from '@tylercoles/mcp-client';

class MyMCPClient implements IMCPClient {
  // Implementation required
}
```

#### `BaseMCPClient`
An abstract base class with common functionality:

```typescript
import { BaseMCPClient } from '@tylercoles/mcp-client';

class MyMCPClient extends BaseMCPClient {
  // Only implement transport-specific methods
  async connect() { /* ... */ }
  async listTools() { /* ... */ }
  // etc.
}
```

### Type Definitions

- `ToolInfo` - Simplified tool metadata
- `ResourceInfo` - Simplified resource metadata  
- `PromptInfo` - Simplified prompt metadata
- `ClientConfig` - Base configuration interface
- `MCPClientFactory` - Factory interface for creating clients

## For End Users

End users should install specific transport packages instead:

- `@tylercoles/mcp-client-stdio` - For stdio transport
- `@tylercoles/mcp-client-http` - For HTTP transport

These packages implement the interfaces defined here and provide ready-to-use clients.

## Architecture

```
@tylercoles/mcp-client (interfaces)
    ↑
    ├── @tylercoles/mcp-client-stdio
    └── @tylercoles/mcp-client-http
```

This design ensures:
- Consistent API across all transport types
- Type safety and intellisense
- Easy mocking for testing
- Pluggable transport implementations

## License

MIT
