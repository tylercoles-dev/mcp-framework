import { MCPServer, ToolResult } from '@tylercoles/mcp-server';
import { KanbanDatabase } from '../database/index.js';
import { KanbanWebSocketServer } from '../websocket-server.js';

export abstract class BaseTool {
  constructor(
    protected db: KanbanDatabase,
    protected wsServer?: KanbanWebSocketServer
  ) {}

  abstract registerTools(server: MCPServer): void;

}