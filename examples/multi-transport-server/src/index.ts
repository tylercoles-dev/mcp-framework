import { MCPServer, z } from '@tylercoles/mcp-server';
import { HttpTransport } from '@tylercoles/mcp-transport-http';
import { StdioTransport } from '@tylercoles/mcp-transport-stdio';
import { NoAuth } from '@tylercoles/mcp-auth';

/**
 * Multi-transport server example
 * Demonstrates running a single MCP server with both HTTP and stdio transports
 * This allows the same server to be accessed via:
 * - HTTP API (for web clients)
 * - stdio (for CLI tools)
 */
async function createMultiTransportServer() {
  // Create the server
  const server = new MCPServer({
    name: 'multi-transport-server',
    version: '1.0.0',
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  });

  // Register tools that will be available on both transports
  server.registerTool(
    'get_time',
    {
      title: 'Get Current Time',
      description: 'Get the current time in various formats',
      inputSchema: {
        format: z.enum(['iso', 'unix', 'human']).optional()
          .describe('Time format (default: iso)')
      }
    },
    async ({ format = 'iso' }, context) => {
      const now = new Date();
      let timeStr: string;
      
      switch (format) {
        case 'unix':
          timeStr = Math.floor(now.getTime() / 1000).toString();
          break;
        case 'human':
          timeStr = now.toLocaleString();
          break;
        case 'iso':
        default:
          timeStr = now.toISOString();
      }

      // Include transport info if available
      const transportInfo = context.transport ? ` (via ${context.transport})` : '';
      
      return {
        content: [{
          type: 'text',
          text: `Current time: ${timeStr}${transportInfo}`
        }]
      };
    }
  );

  server.registerTool(
    'list_capabilities',
    {
      title: 'List Server Capabilities',
      description: 'Get information about available tools, resources, and prompts',
      inputSchema: {}
    },
    async (_, context) => {
      const capabilities = server.getCapabilities();
      
      const report = [
        `Transport: ${context.transport || 'unknown'}`,
        '',
        `Tools (${capabilities.tools.length}):`,
        ...capabilities.tools.map(t => `  - ${t.name}: ${t.description}`),
        '',
        `Resources (${capabilities.resources.length}):`,
        ...capabilities.resources.map(r => `  - ${r.name}: ${r.uri}`),
        '',
        `Prompts (${capabilities.prompts.length}):`,
        ...capabilities.prompts.map(p => `  - ${p.name}: ${p.description || 'No description'}`)
      ].join('\n');
      
      return {
        content: [{
          type: 'text',
          text: report
        }]
      };
    }
  );

  // Register a resource
  server.registerResource(
    'server-info',
    'info://server',
    {
      title: 'Server Information',
      description: 'Information about the multi-transport server',
      mimeType: 'text/plain'
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        text: 'This server supports multiple transports simultaneously.\n' +
              'You can connect via HTTP API or stdio interface.\n' +
              `Available tools: ${server.getTools().map(t => t.name).join(', ')}`
      }]
    })
  );

  // Register a prompt
  server.registerPrompt(
    'analyze_transport',
    {
      title: 'Analyze Transport Usage',
      description: 'Prompt to analyze multi-transport patterns',
      argsSchema: {}
    },
    () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: 'Analyze the benefits and use cases of running an MCP server with multiple transports (HTTP and stdio) simultaneously.'
        }
      }]
    })
  );

  return server;
}

async function main() {
  const server = await createMultiTransportServer();
  
  // Configure transports based on environment
  const enableHttp = process.env.ENABLE_HTTP !== 'false';
  const enableStdio = process.env.ENABLE_STDIO !== 'false';
  const httpPort = parseInt(process.env.HTTP_PORT || '3000', 10);
  
  if (!enableHttp && !enableStdio) {
    console.error('Error: At least one transport must be enabled');
    console.error('Set ENABLE_HTTP=true or ENABLE_STDIO=true');
    process.exit(1);
  }
  
  // Setup HTTP transport
  if (enableHttp) {
    const httpTransport = new HttpTransport({
      port: httpPort,
      host: '127.0.0.1',
      auth: new NoAuth(),
      cors: {
        origin: true
      }
    });
    
    // Add custom context for HTTP requests
    httpTransport.getApp()?.use((req, res, next) => {
      server.setContext({ transport: 'http' });
      next();
    });
    
    server.useTransport(httpTransport);
    console.log(`[Multi-Transport] HTTP transport configured on port ${httpPort}`);
  }
  
  // Setup stdio transport
  if (enableStdio) {
    const stdioTransport = new StdioTransport({
      logStderr: true
    });
    
    // Note: stdio transport doesn't have middleware, but we can set context
    // when the server starts
    server.useTransport(stdioTransport);
    console.error('[Multi-Transport] stdio transport configured');
    
    // Set context for stdio
    server.setContext({ transport: 'stdio' });
  }
  
  // Start the server with all configured transports
  await server.start();
  
  if (enableHttp) {
    console.log(`[Multi-Transport] Server started with ${server.getTools().length} tools`);
    console.log(`[Multi-Transport] HTTP endpoint: http://127.0.0.1:${httpPort}/mcp`);
  }
  
  if (enableStdio) {
    console.error('[Multi-Transport] Ready for stdio communication');
  }
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n[Multi-Transport] Shutting down...');
  process.exit(0);
});

// Run the server
main().catch((error) => {
  console.error('[Multi-Transport] Fatal error:', error);
  process.exit(1);
});
