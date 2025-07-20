import { MCPServer, ToolResult } from '@tylercoles/mcp-server';
import { BaseTool } from '../base-tool.js';
import {
  CreateColumnSchema,
  UpdateColumnSchema,
  ColumnIdSchema,
  UpdateColumnWithIdSchema,
  NotFoundError,
} from '../../types/index.js';

export class ColumnTools extends BaseTool {
  registerTools(server: MCPServer): void {
    this.registerCreateColumnTool(server);
    this.registerUpdateColumnTool(server);
    this.registerDeleteColumnTool(server);
  }

  private registerCreateColumnTool(server: MCPServer): void {
    server.registerTool('create_column', {
      title: 'Create Column',
      description: 'Create a new column in a kanban board',
      inputSchema: CreateColumnSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const input = CreateColumnSchema.safeParse(args);
        if (input.success) {
          const column = await this.db.createColumn(input.data as any);

          // Broadcast the column creation to all clients connected to this board
          if (this.wsServer) {
            this.wsServer.broadcastToBoardClients(column.board_id!, 'column_created', column);
          }

          return this.createSuccessResult(`✅ Successfully created column "${column.name}" (ID: ${column.id})`);
        }

        throw input.error;
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }

  private registerUpdateColumnTool(server: MCPServer): void {
    server.registerTool('update_column', {
      title: 'Update Column',
      description: 'Update an existing column',
      inputSchema: UpdateColumnWithIdSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const { column_id, ...updates } = args;
        const input = UpdateColumnSchema.parse(updates);
        const column = await this.db.updateColumn(column_id, input);

        if (!column) {
          throw new NotFoundError('Column', column_id);
        }

        // Broadcast the column update to all clients connected to this board
        if (this.wsServer) {
          this.wsServer.broadcastToBoardClients(column.board_id!, 'column_updated', column);
        }

        return this.createSuccessResult(`✅ Successfully updated column "${column.name}" (ID: ${column.id})`);
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }

  private registerDeleteColumnTool(server: MCPServer): void {
    server.registerTool('delete_column', {
      title: 'Delete Column',
      description: 'Delete a column and all its cards',
      inputSchema: ColumnIdSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const { column_id } = args;
        
        // Get the column before deleting to get board_id for broadcasting
        const column = await this.db.getColumn(column_id);
        if (!column) {
          throw new NotFoundError('Column', column_id);
        }

        const deleted = await this.db.deleteColumn(column_id);

        if (!deleted) {
          throw new NotFoundError('Column', column_id);
        }

        // Broadcast the column deletion to all clients connected to this board
        if (this.wsServer) {
          this.wsServer.broadcastToBoardClients(column.board_id, 'column_deleted', { column_id });
        }

        return this.createSuccessResult(`✅ Successfully deleted column (ID: ${column_id})`);
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }
}