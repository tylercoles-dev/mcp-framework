import { MCPServer, z } from '@tylercoles/mcp-server';
import { StdioTransport } from '@tylercoles/mcp-transport-stdio';

/**
 * Simple echo server example using stdio transport
 * This is the simplest possible MCP server implementation
 */
async function main() {
  // Create the server
  const server = new MCPServer({
    name: 'echo-server',
    version: '1.0.0'
  });

  // Register a simple echo tool
  server.registerTool(
    'echo',
    {
      title: 'Echo Tool',
      description: 'Echoes back the provided message',
      inputSchema: z.object({
        message: z.string().describe('Message to echo back')
      })
    },
    async ({ message }) => ({
      content: [{
        type: 'text',
        text: `Echo: ${message}`
      }]
    })
  );

  // Register a reverse echo tool
  server.registerTool(
    'reverse_echo',
    {
      title: 'Reverse Echo Tool',
      description: 'Echoes back the message in reverse',
      inputSchema: z.object({
        message: z.string().describe('Message to reverse and echo')
      })
    },
    async ({ message }) => ({
      content: [{
        type: 'text',
        text: `Reverse Echo: ${message.split('').reverse().join('')}`
      }]
    })
  );

  // Use stdio transport (for command-line usage)
  const transport = new StdioTransport({
    logStderr: true // Enable logging to stderr for debugging
  });

  server.useTransport(transport);

  // Start the server
  await server.start();
  
  console.error('[Echo Server] Started successfully on stdio transport');
}

// Run the server
main().catch((error) => {
  console.error('[Echo Server] Fatal error:', error);
  process.exit(1);
});
