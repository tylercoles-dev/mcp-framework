import { MCPServer, ToolResult } from '@tylercoles/mcp-server';
import { BaseTool } from '../base-tool.js';
import {
  CreateCardSchema,
  UpdateCardSchema,
  MoveCardSchema,
  CardIdSchema,
  UpdateCardWithIdSchema,
  NotFoundError,
  ValidationError,
} from '../../types/index.js';

export class CardTools extends BaseTool {
  registerTools(server: MCPServer): void {
    this.registerCreateCardTool(server);
    this.registerUpdateCardTool(server);
    this.registerMoveCardTool(server);
    this.registerDeleteCardTool(server);
  }

  private registerCreateCardTool(server: MCPServer): void {
    server.registerTool('create_card', {
      title: 'Create Card',
      description: 'Create a new card in a column. Specify the column by name (e.g., "To Do") or position (0-based index)',
      inputSchema: CreateCardSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const input = CreateCardSchema.parse(args);
        
        // Validate that at least one column specifier is provided
        if (!input.column_name && input.column_position === undefined) {
          throw new ValidationError('Must specify either column_name or column_position');
        }
        
        // Get columns for the board
        const columns = await this.db.getColumnsByBoard(input.board_id);
        if (columns.length === 0) {
          throw new ValidationError(`Board ${input.board_id} has no columns`);
        }
        
        // Resolve column_id based on name or position
        let column_id: number;
        if (input.column_name) {
          const column = columns.find(c => c.name.toLowerCase() === input.column_name!.toLowerCase());
          if (!column) {
            throw new ValidationError(`Column "${input.column_name}" not found in board ${input.board_id}`);
          }
          column_id = column.id!;
        } else if (input.column_position !== undefined) {
          if (input.column_position >= columns.length) {
            throw new ValidationError(`Column position ${input.column_position} is out of range (board has ${columns.length} columns)`);
          }
          column_id = columns[input.column_position].id!;
        } else {
          // This shouldn't happen due to the validation above, but just in case
          throw new ValidationError('Must specify either column_name or column_position');
        }
        
        const card = await this.db.createCard({
          board_id: input.board_id,
          column_id: column_id,
          title: input.title,
          description: input.description || null,
          position: input.position,
          priority: input.priority,
          assigned_to: input.assigned_to || null,
          due_date: input.due_date || null,
        });

        // Broadcast to WebSocket clients
        if (this.wsServer) {
          console.log(`MCP Tool: Broadcasting card_created for board ${input.board_id}, card:`, card.title);
          this.wsServer.broadcastToBoardClients(input.board_id, 'card_created', card);
        } else {
          console.log('MCP Tool: No WebSocket server available for broadcasting');
        }

        return this.createSuccessResult(`✅ Successfully created card "${card.title}" (ID: ${card.id})`);
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }

  private registerUpdateCardTool(server: MCPServer): void {
    server.registerTool('update_card', {
      title: 'Update Card',
      description: 'Update an existing card',
      inputSchema: UpdateCardWithIdSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const { card_id, ...updates } = args;
        const input = UpdateCardSchema.parse(updates);
        const card = await this.db.updateCard(card_id, input);

        if (!card) {
          throw new NotFoundError('Card', card_id);
        }

        // Broadcast to WebSocket clients
        if (this.wsServer) {
          this.wsServer.broadcastToBoardClients(card.board_id!, 'card_updated', card);
        }

        return this.createSuccessResult(`✅ Successfully updated card "${card.title}" (ID: ${card.id})`);
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }

  private registerMoveCardTool(server: MCPServer): void {
    server.registerTool('move_card', {
      title: 'Move Card',
      description: 'Move a card to a different column or position. Specify the column by name (e.g., "Done") or position (0-based index)',
      inputSchema: MoveCardSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const input = MoveCardSchema.parse(args);
        
        // Validate that at least one column specifier is provided
        if (!input.column_name && input.column_position === undefined) {
          throw new ValidationError('Must specify either column_name or column_position');
        }
        
        // Get the card to find its board_id
        const existingCard = await this.db.getCardById(input.card_id);
        if (!existingCard) {
          throw new NotFoundError('Card', input.card_id);
        }
        
        // Get columns for the board
        const columns = await this.db.getColumnsByBoard(existingCard.board_id);
        if (columns.length === 0) {
          throw new ValidationError(`Board ${existingCard.board_id} has no columns`);
        }
        
        // Resolve column_id based on name or position
        let column_id: number;
        let columnName: string;
        if (input.column_name) {
          const column = columns.find(c => c.name.toLowerCase() === input.column_name!.toLowerCase());
          if (!column) {
            throw new ValidationError(`Column "${input.column_name}" not found in board ${existingCard.board_id}`);
          }
          column_id = column.id!;
          columnName = column.name;
        } else if (input.column_position !== undefined) {
          if (input.column_position >= columns.length) {
            throw new ValidationError(`Column position ${input.column_position} is out of range (board has ${columns.length} columns)`);
          }
          column_id = columns[input.column_position].id!;
          columnName = columns[input.column_position].name;
        } else {
          // This shouldn't happen due to the validation above, but just in case
          throw new ValidationError('Must specify either column_name or column_position');
        }
        
        const card = await this.db.moveCard(input.card_id, column_id, input.position);

        if (!card) {
          throw new NotFoundError('Card', input.card_id);
        }

        // Broadcast to WebSocket clients
        if (this.wsServer) {
          this.wsServer.broadcastToBoardClients(card.board_id!, 'card_moved', card);
        }

        return this.createSuccessResult(`✅ Successfully moved card "${card.title}" to column "${columnName}" at position ${input.position}`);
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }

  private registerDeleteCardTool(server: MCPServer): void {
    server.registerTool('delete_card', {
      title: 'Delete Card',
      description: 'Delete a card',
      inputSchema: CardIdSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const { card_id } = args;
        const deleted = await this.db.deleteCard(card_id);

        if (!deleted) {
          throw new NotFoundError('Card', card_id);
        }

        return this.createSuccessResult(`✅ Successfully deleted card (ID: ${card_id})`);
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }
}