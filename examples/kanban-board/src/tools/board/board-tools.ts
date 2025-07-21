import { EmptySchema, ToolModule, ToolResult, createErrorResult, createSuccessObjectResult, createSuccessResult } from '@tylercoles/mcp-server';
import {
  CreateBoardSchema,
  UpdateBoardSchema,
  BoardIdSchema,
  UpdateBoardWithIdSchema,
  NotFoundError,
  ValidationError,
  KanbanBoardData,
} from '../../types/index.js';
import { Board, KanbanDatabase } from '../../database/index.js'
import { KanbanWebSocketServer } from '../../websocket-server.js';

export const registerGetBoardsTool = (db: KanbanDatabase): ToolModule => ({
  name: 'get_boards',
  config: {
    title: 'Get All Boards',
    description: 'Retrieve all kanban boards',
    inputSchema: EmptySchema,
  },
  handler: async (): Promise<ToolResult> => {
    try {
      const boards = await db.getBoards();
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
      return createErrorResult(error);
    }
  }
});

export const registerGetBoardTool = (db: KanbanDatabase): ToolModule => ({
  name: 'get_board',
  config: {
    title: 'Get Board Details',
    description: 'Retrieve detailed information about a specific board including columns and cards',
    inputSchema: BoardIdSchema,
  }, handler: async (args: any): Promise<ToolResult> => {
    try {
      const { board_id } = args;
      const board = await db.getBoardById(board_id);
      if (!board) {
        throw new NotFoundError('Board', board_id);
      }

      const columns = await db.getColumnsByBoard(board_id);
      const boardData: KanbanBoardData = {
        board: board as Board & { id: number },
        columns: await Promise.all(
          columns.map(async (column) => {
            const cards = await db.getCardsByColumn(column.id!);
            const cardsWithTags = await Promise.all(
              cards.map(async (card) => {
                const tags = await db.getCardTags(card.id!);
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

      return createSuccessObjectResult(boardData, `# ${board.name}\n\n${board.description || 'No description'}\n\n## Columns:\n${boardData.columns
        .map(
          (col) =>
            `### ${col.name} (${col.cards.length} cards)\n${col.cards
              .map((card) => `- **${card.title}** (${card.priority})`)
              .join('\n')}`
        )
        .join('\n\n')}`);
    } catch (error) {
      return createErrorResult(error);
    }
  }
});

export const registerCreateBoardTool = (db: KanbanDatabase, wsServer: KanbanWebSocketServer): ToolModule => ({
  name: 'create_board', config: {
    title: 'Create New Board',
    description: 'Create a new kanban board',
    inputSchema: CreateBoardSchema,
  }, handler: async (args: any): Promise<ToolResult> => {
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
      const board = await db.createBoard({
        name: input.name,
        description: input.description || null,
        color: input.color,
      });

      // Broadcast to WebSocket clients
      if (wsServer) {
        wsServer.broadcastToAll('board_created', board);
      }

      return createSuccessResult(`✅ Successfully created board "${board.name}" (ID: ${board.id})`);
    } catch (error) {
      return createErrorResult(error);
    }
  }
});

export const registerUpdateBoardTool = (db: KanbanDatabase): ToolModule => ({
  name: 'update_board', config: {
    title: 'Update Board',
    description: 'Update an existing kanban board',
    inputSchema: UpdateBoardWithIdSchema,
  },
  handler: async (args: any): Promise<ToolResult> => {
    try {
      const { board_id, ...updates } = args;
      const input = UpdateBoardSchema.parse(updates);
      const board = await db.updateBoard(board_id, input);

      if (!board) {
        throw new NotFoundError('Board', board_id);
      }

      return createSuccessResult(`✅ Successfully updated board "${board.name}" (ID: ${board.id})`);
    } catch (error) {
      return createErrorResult(error);
    }
  }
});

export const registerDeleteBoardTool = (db: KanbanDatabase): ToolModule => ({
  name: 'delete_board',
  config: {
    title: 'Delete Board',
    description: 'Delete a kanban board and all its columns and cards',
    inputSchema: BoardIdSchema,
  }, handler: async (args: any): Promise<ToolResult> => {
    try {
      const { board_id } = args;
      const deleted = await db.deleteBoard(board_id);

      if (!deleted) {
        throw new NotFoundError('Board', board_id);
      }

      return createSuccessResult(`✅ Successfully deleted board (ID: ${board_id})`);
    } catch (error) {
      return createErrorResult(error);
    }
  }
});