# MCP Framework Introspection Guide

## Overview

The MCP framework provides comprehensive introspection capabilities that allow servers, tools, and clients to discover available functionality at runtime. This enables dynamic UIs, meta-tools, and better debugging.

## Core Introspection Methods

### MCPServer Methods

```typescript
// Get all registered tools
const tools: ToolInfo[] = server.getTools();

// Get a specific tool by name
const tool: ToolInfo | undefined = server.getTool('tool_name');

// Get all registered resources  
const resources: ResourceInfo[] = server.getResources();

// Get a specific resource by name
const resource: ResourceInfo | undefined = server.getResource('resource_name');

// Get all registered prompts
const prompts: PromptInfo[] = server.getPrompts();

// Get a specific prompt by name
const prompt: PromptInfo | undefined = server.getPrompt('prompt_name');

// Get complete capabilities summary
const capabilities = server.getCapabilities();
// Returns: { tools: ToolInfo[], resources: ResourceInfo[], prompts: PromptInfo[] }
```

## Information Available

### ToolInfo
```typescript
interface ToolInfo {
  name: string;          // Unique identifier
  title?: string;        // Human-readable title
  description: string;   // What the tool does
  inputSchema: any;      // Zod schema or plain object
}
```

### ResourceInfo
```typescript
interface ResourceInfo {
  name: string;          // Unique identifier
  uri: string;           // URI template or pattern
  title?: string;        // Human-readable title
  description?: string;  // What the resource provides
  mimeType?: string;     // Content type
}
```

### PromptInfo
```typescript
interface PromptInfo {
  name: string;          // Unique identifier
  title?: string;        // Human-readable title
  description?: string;  // What the prompt does
  arguments?: any[];     // Argument names
}
```

## Use Cases

### 1. Dynamic Tool Discovery

Tools can discover what other tools are available:

```typescript
server.registerTool(
  "list_available_tools",
  {
    description: "List all available tools",
    inputSchema: {}
  },
  async () => {
    const tools = server.getTools();
    const toolList = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
    return {
      content: [{
        type: 'text',
        text: `Available tools:\n${toolList}`
      }]
    };
  }
);
```

### 2. REST API Integration

Expose introspection via REST endpoints:

```typescript
// List all tools
app.get('/api/tools', (req, res) => {
  const tools = mcpServer.getTools();
  res.json({ tools });
});

// Get specific tool details
app.get('/api/tools/:name', (req, res) => {
  const tool = mcpServer.getTool(req.params.name);
  if (!tool) {
    return res.status(404).json({ error: 'Tool not found' });
  }
  res.json(tool);
});

// Get all capabilities
app.get('/api/capabilities', (req, res) => {
  const capabilities = mcpServer.getCapabilities();
  res.json(capabilities);
});
```

### 3. Dynamic UI Generation

Build UIs that adapt to available tools:

```typescript
// React component example
function ToolsList() {
  const [tools, setTools] = useState([]);
  
  useEffect(() => {
    fetch('/api/tools')
      .then(r => r.json())
      .then(data => setTools(data.tools));
  }, []);
  
  return (
    <div>
      {tools.map(tool => (
        <ToolCard 
          key={tool.name}
          name={tool.name}
          title={tool.title}
          description={tool.description}
          schema={tool.inputSchema}
        />
      ))}
    </div>
  );
}
```

### 4. Debugging and Monitoring

Log server capabilities on startup:

```typescript
async function startServer() {
  // ... setup code ...
  
  await server.start();
  
  const capabilities = server.getCapabilities();
  console.log(`Server started with:
    - ${capabilities.tools.length} tools
    - ${capabilities.resources.length} resources  
    - ${capabilities.prompts.length} prompts
  `);
  
  if (process.env.DEBUG) {
    console.log('Available tools:', capabilities.tools.map(t => t.name));
  }
}
```

### 5. Client-Side Discovery

MCP clients can use introspection to build dynamic interfaces:

```typescript
// Discover available tools after connecting
const toolsResponse = await client.listTools();
const tools = toolsResponse.tools;

// Build UI based on available tools
tools.forEach(tool => {
  createToolButton(tool.name, tool.description);
});
```

## Best Practices

### 1. Use Descriptive Metadata

Always provide clear titles and descriptions:

```typescript
server.registerTool(
  "analyze_data",
  {
    title: "Data Analyzer",  // Human-friendly name
    description: "Analyze datasets and generate insights with statistical summaries",
    inputSchema: {
      data: z.array(z.number()).describe("Array of numerical values to analyze"),
      options: z.object({
        includeOutliers: z.boolean().describe("Include outlier detection")
      }).optional()
    }
  },
  handler
);
```

### 2. Version Your APIs

Include version info in capabilities:

```typescript
app.get('/api/capabilities', (req, res) => {
  const capabilities = mcpServer.getCapabilities();
  res.json({
    version: '1.0.0',
    server: {
      name: 'my-mcp-server',
      version: '1.0.0'
    },
    ...capabilities
  });
});
```

### 3. Cache Introspection Results

For performance, cache introspection results if they don't change:

```typescript
let capabilitiesCache = null;

app.get('/api/capabilities', (req, res) => {
  if (!capabilitiesCache) {
    capabilitiesCache = mcpServer.getCapabilities();
  }
  res.json(capabilitiesCache);
});
```

### 4. Document Schema Formats

When exposing schemas, document the format:

```typescript
app.get('/api/tools/:name', (req, res) => {
  const tool = mcpServer.getTool(req.params.name);
  if (!tool) {
    return res.status(404).json({ error: 'Tool not found' });
  }
  
  res.json({
    ...tool,
    schemaFormat: 'zod', // or 'json-schema', etc.
    schemaVersion: '1.0'
  });
});
```

## Example: Complete Introspection Server

Here's a minimal example showing all introspection features:

```typescript
import { MCPServer, z } from '@tylercoles/mcp-server';
import { HttpTransport } from '@tylercoles/mcp-transport-http';
import express from 'express';

// Create server
const server = new MCPServer({
  name: 'introspection-demo',
  version: '1.0.0'
});

// Register some tools
server.registerTool(
  'echo',
  {
    title: 'Echo Tool',
    description: 'Echoes back input',
    inputSchema: { message: z.string() }
  },
  async ({ message }) => ({
    content: [{ type: 'text', text: message }]
  })
);

// Meta-tool that uses introspection
server.registerTool(
  'help',
  {
    title: 'Help',
    description: 'Get help about available tools',
    inputSchema: {}
  },
  async () => {
    const tools = server.getTools();
    const help = tools
      .filter(t => t.name !== 'help')
      .map(t => `${t.title || t.name}: ${t.description}`)
      .join('\n');
    
    return {
      content: [{
        type: 'text',
        text: `Available tools:\n${help}`
      }]
    };
  }
);

// Create HTTP transport
const transport = new HttpTransport({ port: 3000 });

// Get Express app and add introspection routes
const app = transport.getApp();
if (app) {
  app.get('/api/tools', (req, res) => {
    res.json({ tools: server.getTools() });
  });
  
  app.get('/api/capabilities', (req, res) => {
    res.json(server.getCapabilities());
  });
}

// Start server
server.useTransport(transport);
await server.start();

console.log('Server running with introspection at:');
console.log('- MCP: http://localhost:3000/mcp');
console.log('- Tools API: http://localhost:3000/api/tools');
console.log('- Capabilities: http://localhost:3000/api/capabilities');
```

## Conclusion

Introspection is a powerful feature of the MCP framework that enables:
- Dynamic discovery of server capabilities
- Building adaptive user interfaces
- Creating meta-tools that understand their environment
- Better debugging and monitoring
- REST API integration alongside MCP protocol

Use these features to build more flexible and maintainable MCP servers!
