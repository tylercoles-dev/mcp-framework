import { MCPServer, ToolResult } from '@tylercoles/mcp-server';
import { KanbanDatabase, Board, Column, Card, Tag, Comment } from '../database';
import { KanbanWebSocketServer } from '../websocket-server';
import {
  CreateBoardSchema,
  UpdateBoardSchema,
  CreateColumnSchema,
  UpdateColumnSchema,
  CreateCardSchema,
  UpdateCardSchema,
  MoveCardSchema,
  CreateTagSchema,
  CreateCommentSchema,
  BoardIdSchema,
  UpdateBoardWithIdSchema,
  ColumnIdSchema,
  UpdateColumnWithIdSchema,
  CardIdSchema,
  UpdateCardWithIdSchema,
  CommentIdSchema,
  CardTagSchema,
  SearchCardsSchema,
  EmptySchema,
  NotFoundError,
  ValidationError,
  KanbanBoardData,
  KanbanStats,
} from '../types/index';

export class KanbanTools {
  constructor(
    private db: KanbanDatabase,
    private wsServer?: KanbanWebSocketServer
  ) { }

  registerTools(server: MCPServer) {
    // Board management tools
    this.registerGetBoardsTool(server);
    this.registerGetBoardTool(server);
    this.registerCreateBoardTool(server);
    this.registerUpdateBoardTool(server);
    this.registerDeleteBoardTool(server);

    // Column management tools
    this.registerCreateColumnTool(server);
    this.registerUpdateColumnTool(server);
    this.registerDeleteColumnTool(server);

    // Card management tools
    this.registerCreateCardTool(server);
    this.registerUpdateCardTool(server);
    this.registerMoveCardTool(server);
    this.registerDeleteCardTool(server);

    // Tag management tools
    this.registerGetTagsTool(server);
    this.registerCreateTagTool(server);
    this.registerAddCardTagTool(server);
    this.registerRemoveCardTagTool(server);

    // Comment management tools
    this.registerAddCommentTool(server);
    this.registerGetCommentsTool(server);
    this.registerDeleteCommentTool(server);

    // Analytics and reporting tools
    this.registerGetStatsTool(server);
    this.registerSearchCardsTool(server);
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
        return {
          content: [
            {
              type: 'text',
              text: `Error retrieving boards: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
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
        return {
          content: [
            {
              type: 'text',
              text: `Error retrieving board: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
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

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully created board "${board.name}" (ID: ${board.id})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating board: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
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

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully updated board "${board.name}" (ID: ${board.id})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error updating board: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
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

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully deleted board (ID: ${board_id})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error deleting board: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
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

          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully created column "${column.name}" (ID: ${column.id})`,
              },
            ],
          };
        }

        throw input.error;
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating column: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
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

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully updated column "${column.name}" (ID: ${column.id})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error updating column: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
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

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully deleted column (ID: ${column_id})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error deleting column: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
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
          // This shouldn't happen due to the refine validation, but just in case
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

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully created card "${card.title}" (ID: ${card.id})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating card: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
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

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully updated card "${card.title}" (ID: ${card.id})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error updating card: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
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
          // This shouldn't happen due to the refine validation, but just in case
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

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully moved card "${card.title}" to column "${columnName}" at position ${input.position}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error moving card: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
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

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully deleted card (ID: ${card_id})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error deleting card: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private registerGetTagsTool(server: MCPServer): void {
    server.registerTool('get_tags', {
      title: 'Get All Tags',
      description: 'Retrieve all available tags',
      inputSchema: EmptySchema,
    }, async (): Promise<ToolResult> => {
      try {
        const tags = await this.db.getTags();
        return {
          content: [
            {
              type: 'text',
              text: `Found ${tags.length} tags:\n\n${tags
                .map((tag) => `• **${tag.name}** (${tag.color})`)
                .join('\n')}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error retrieving tags: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private registerCreateTagTool(server: MCPServer): void {
    server.registerTool('create_tag', {
      title: 'Create Tag',
      description: 'Create a new tag',
      inputSchema: CreateTagSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const input = CreateTagSchema.safeParse(args);
        if (input.success) {
          const tag = await this.db.createTag(input.data as any);

          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully created tag "${tag.name}" (ID: ${tag.id})`,
              },
            ],
          };
        }
        else
          throw input.error;
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating tag: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private registerAddCardTagTool(server: MCPServer): void {
    server.registerTool('add_card_tag', {
      title: 'Add Tag to Card',
      description: 'Add a tag to a card',
      inputSchema: CardTagSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const { card_id, tag_id } = args;
        await this.db.addCardTag(card_id, tag_id);

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully added tag ${tag_id} to card ${card_id}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error adding tag to card: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private registerRemoveCardTagTool(server: MCPServer): void {
    server.registerTool('remove_card_tag', {
      title: 'Remove Tag from Card',
      description: 'Remove a tag from a card',
      inputSchema: CardTagSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const { card_id, tag_id } = args;
        const removed = await this.db.removeCardTag(card_id, tag_id);

        if (!removed) {
          throw new ValidationError('Tag not found on card');
        }

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully removed tag ${tag_id} from card ${card_id}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error removing tag from card: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private registerAddCommentTool(server: MCPServer): void {
    server.registerTool('add_comment', {
      title: 'Add Comment',
      description: 'Add a comment to a card',
      inputSchema: CreateCommentSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const input = CreateCommentSchema.parse(args);
        const comment = await this.db.addComment({
          card_id: input.card_id,
          content: input.content,
          author: input.author || null,
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully added comment to card ${comment.card_id}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error adding comment: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private registerGetCommentsTool(server: MCPServer): void {
    server.registerTool('get_comments', {
      title: 'Get Card Comments',
      description: 'Get all comments for a card',
      inputSchema: CardIdSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const { card_id } = args;
        const comments = await this.db.getCardComments(card_id);

        return {
          content: [
            {
              type: 'text',
              text: `Found ${comments.length} comments for card ${card_id}:\n\n${comments
                .map(
                  (comment) =>
                    `**${comment.author || 'Anonymous'}** (${new Date(comment.created_at).toLocaleString()}):\n${comment.content}`
                )
                .join('\n\n')}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error retrieving comments: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private registerDeleteCommentTool(server: MCPServer): void {
    server.registerTool('delete_comment', {
      title: 'Delete Comment',
      description: 'Delete a comment',
      inputSchema: CommentIdSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const { comment_id } = args;
        const deleted = await this.db.deleteComment(comment_id);

        if (!deleted) {
          throw new NotFoundError('Comment', comment_id);
        }

        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully deleted comment (ID: ${comment_id})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error deleting comment: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private registerGetStatsTool(server: MCPServer): void {
    server.registerTool('get_stats', {
      title: 'Get Kanban Statistics',
      description: 'Get analytics and statistics for the kanban system',
      inputSchema: EmptySchema,
    }, async (): Promise<ToolResult> => {
      try {
        const boards = await this.db.getBoards();
        const allCards = await Promise.all(
          boards.map(board => this.db.getCardsByBoard(board.id!))
        ).then(cardArrays => cardArrays.flat());

        const cardsByPriority = allCards.reduce(
          (acc, card) => {
            acc[card.priority] = (acc[card.priority] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        const today = new Date().toISOString().split('T')[0];
        const overdueCards = allCards.filter(
          card => card.due_date && card.due_date < today
        ).length;

        const stats: KanbanStats = {
          total_boards: boards.length,
          total_cards: allCards.length,
          cards_by_priority: cardsByPriority as any,
          cards_by_status: {},
          overdue_cards: overdueCards,
          recent_activity: [],
        };

        return {
          content: [
            {
              type: 'text',
              text: `# Kanban Statistics\n\n**Boards:** ${stats.total_boards}\n**Total Cards:** ${stats.total_cards}\n**Overdue Cards:** ${stats.overdue_cards}\n\n## Cards by Priority:\n${Object.entries(cardsByPriority)
                .map(([priority, count]) => `- ${priority}: ${count}`)
                .join('\n')}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error retrieving statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private registerSearchCardsTool(server: MCPServer): void {
    server.registerTool('search_cards', {
      title: 'Search Cards',
      description: 'Search for cards by title, description, or assignee',
      inputSchema: SearchCardsSchema,
    }, async (args: any): Promise<ToolResult> => {
      try {
        const { query, board_id, priority, assigned_to } = args;

        // Simple search implementation - in a real app you'd want full-text search
        let cards: Card[];
        if (board_id) {
          cards = await this.db.getCardsByBoard(board_id);
        } else {
          const boards = await this.db.getBoards();
          const allCards = await Promise.all(
            boards.map(board => this.db.getCardsByBoard(board.id!))
          );
          cards = allCards.flat();
        }

        const filteredCards = cards.filter(card => {
          const matchesQuery =
            card.title.toLowerCase().includes(query.toLowerCase()) ||
            (card.description && card.description.toLowerCase().includes(query.toLowerCase()));

          const matchesPriority = !priority || card.priority === priority;
          const matchesAssignee = !assigned_to || card.assigned_to === assigned_to;

          return matchesQuery && matchesPriority && matchesAssignee;
        });

        return {
          content: [
            {
              type: 'text',
              text: `Found ${filteredCards.length} cards matching "${query}":\n\n${filteredCards
                .map(
                  (card) =>
                    `• **${card.title}** (ID: ${card.id})\n  Priority: ${card.priority}\n  Assigned: ${card.assigned_to || 'Unassigned'}\n  ${card.description || 'No description'}`
                )
                .join('\n\n')}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error searching cards: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }
}