import { MCPServer, ToolResult } from '@tylercoles/mcp-server';
import { BaseTool } from '../base-tool.js';
import {
  CreateBoardSchema,
  UpdateBoardSchema,
  BoardIdSchema,
  UpdateBoardWithIdSchema,
  EmptySchema,
  NotFoundError,
  ValidationError,
  KanbanBoardData,
} from '../../types/index.js';
import { Board, Column, Card } from '../../database/index.js';

export class BoardTools extends BaseTool {
  registerTools(server: MCPServer): void {
    this.registerGetBoardsTool(server);
    this.registerGetBoardTool(server);
    this.registerCreateBoardTool(server);
    this.registerUpdateBoardTool(server);
    this.registerDeleteBoardTool(server);
  }

  private registerGetBoardsTool(server: MCPServer): void {
    server.registerTool('get_boards', {
      title: 'Get All Boards',
      description: 'Retrieve all kanban boards',
      inputSchema: EmptySchema,
    }, async (): Promise<ToolResult> => {
      try {
        const boards = await this.db.getBoards();
        return {
          content: [
            {
              type: 'text',
              text: `Found ${boards.length} boards:\n\n${boards
                .map(
                  (board) =>
                    `• **${board.name}** (ID: ${board.id})\n  ${board.description || 'No description'}\n  Created: ${new Date(board.created_at).toLocaleDateString()}`
                )
                .join('\n\n')}`,
            },
          ],
          structuredContent: { boards },
        };
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }

  private registerGetBoardTool(server: MCPServer): void {
    server.registerTool('get_board', {
      title: 'Get Board Details',
      description: 'Retrieve detailed information about a specific board including columns and cards',
      inputSchema: BoardIdSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const { board_id } = args;
        const board = await this.db.getBoardById(board_id);
        if (!board) {
          throw new NotFoundError('Board', board_id);
        }

        const columns = await this.db.getColumnsByBoard(board_id);
        const boardData: KanbanBoardData = {
          board: board as Board & { id: number },
          columns: await Promise.all(
            columns.map(async (column) => {
              const cards = await this.db.getCardsByColumn(column.id!);
              const cardsWithTags = await Promise.all(
                cards.map(async (card) => {
                  const tags = await this.db.getCardTags(card.id!);
                  return {
                    ...card,
                    id: card.id!,
                    tags: tags.map(tag => ({ ...tag, id: tag.id! }))
                  };
                })
              );
              return { ...column, id: column.id!, cards: cardsWithTags };
            })
          ),
        };

        return {
          content: [
            {
              type: 'text',
              text: `# ${board.name}\n\n${board.description || 'No description'}\n\n## Columns:\n${boardData.columns
                .map(
                  (col) =>
                    `### ${col.name} (${col.cards.length} cards)\n${col.cards
                      .map((card) => `- **${card.title}** (${card.priority})`)
                      .join('\n')}`
                )
                .join('\n\n')}`,
            },
          ],
          structuredContent: boardData as any,
        };
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }

  private registerCreateBoardTool(server: MCPServer): void {
    server.registerTool('create_board', {
      title: 'Create New Board',
      description: 'Create a new kanban board',
      inputSchema: CreateBoardSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        // Validate input with proper error handling
        const parseResult = CreateBoardSchema.safeParse(args);
        if (!parseResult.success) {
          const errorMessages = parseResult.error.errors.map(err =>
            `${err.path.join('.')}: ${err.message}`
          ).join(', ');
          throw new ValidationError(`Invalid input: ${errorMessages}`);
        }

        const input = parseResult.data;
        const board = await this.db.createBoard({
          name: input.name,
          description: input.description || null,
          color: input.color,
        });

        // Broadcast to WebSocket clients
        if (this.wsServer) {
          this.wsServer.broadcastToAll('board_created', board);
        }

        return this.createSuccessResult(`✅ Successfully created board "${board.name}" (ID: ${board.id})`);
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }

  private registerUpdateBoardTool(server: MCPServer): void {
    server.registerTool('update_board', {
      title: 'Update Board',
      description: 'Update an existing kanban board',
      inputSchema: UpdateBoardWithIdSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const { board_id, ...updates } = args;
        const input = UpdateBoardSchema.parse(updates);
        const board = await this.db.updateBoard(board_id, input);

        if (!board) {
          throw new NotFoundError('Board', board_id);
        }

        return this.createSuccessResult(`✅ Successfully updated board "${board.name}" (ID: ${board.id})`);
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }

  private registerDeleteBoardTool(server: MCPServer): void {
    server.registerTool('delete_board', {
      title: 'Delete Board',
      description: 'Delete a kanban board and all its columns and cards',
      inputSchema: BoardIdSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const { board_id } = args;
        const deleted = await this.db.deleteBoard(board_id);

        if (!deleted) {
          throw new NotFoundError('Board', board_id);
        }

        return this.createSuccessResult(`✅ Successfully deleted board (ID: ${board_id})`);
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }
}