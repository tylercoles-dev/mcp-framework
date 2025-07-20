import { MCPServer, ToolResult } from '@tylercoles/mcp-server';
import { KanbanDatabase } from '../database/index.js';
import { KanbanWebSocketServer } from '../websocket-server.js';

export abstract class BaseTool {
  constructor(
    protected db: KanbanDatabase,
    protected wsServer?: KanbanWebSocketServer
  ) {}

  abstract registerTools(server: MCPServer): void;

  protected createErrorResult(error: unknown): ToolResult {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }

  protected createSuccessResult(message: string): ToolResult {
    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
    };
  }
}