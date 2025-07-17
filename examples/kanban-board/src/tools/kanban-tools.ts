import { Tool, ToolResult } from '@tylercoles/mcp-server';
import { KanbanDatabase, Board, Column, Card, Tag, Comment } from '../database/index.js';
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
  NotFoundError,
  ValidationError,
  KanbanBoardData,
  KanbanStats,
} from '../types/index.js';

export class KanbanTools {
  constructor(private db: KanbanDatabase) {}

  getTools(): Tool[] {
    return [
      // Board management tools
      this.createGetBoardsTool(),
      this.createGetBoardTool(),
      this.createCreateBoardTool(),
      this.createUpdateBoardTool(),
      this.createDeleteBoardTool(),

      // Column management tools
      this.createCreateColumnTool(),
      this.createUpdateColumnTool(),
      this.createDeleteColumnTool(),

      // Card management tools
      this.createCreateCardTool(),
      this.createUpdateCardTool(),
      this.createMoveCardTool(),
      this.createDeleteCardTool(),

      // Tag management tools
      this.createGetTagsTool(),
      this.createCreateTagTool(),
      this.createAddCardTagTool(),
      this.createRemoveCardTagTool(),

      // Comment management tools
      this.createAddCommentTool(),
      this.createGetCommentsTool(),
      this.createDeleteCommentTool(),

      // Analytics and reporting tools
      this.createGetStatsTool(),
      this.createSearchCardsTool(),
    ];
  }

  private createGetBoardsTool(): Tool {
    return {
      name: 'get_boards',
      title: 'Get All Boards',
      description: 'Retrieve all kanban boards',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async (): Promise<ToolResult> => {
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
            structuredContent: boards,
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
      },
    };
  }

  private createGetBoardTool(): Tool {
    return {
      name: 'get_board',
      title: 'Get Board Details',
      description: 'Retrieve detailed information about a specific board including columns and cards',
      inputSchema: {
        type: 'object',
        properties: {
          board_id: {
            type: 'number',
            description: 'The ID of the board to retrieve',
          },
        },
        required: ['board_id'],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const { board_id } = args;
          const board = await this.db.getBoardById(board_id);
          if (!board) {
            throw new NotFoundError('Board', board_id);
          }

          const columns = await this.db.getColumnsByBoard(board_id);
          const boardData: KanbanBoardData = {
            board,
            columns: await Promise.all(
              columns.map(async (column) => {
                const cards = await this.db.getCardsByColumn(column.id);
                const cardsWithTags = await Promise.all(
                  cards.map(async (card) => {
                    const tags = await this.db.getCardTags(card.id);
                    return { ...card, tags };
                  })
                );
                return { ...column, cards: cardsWithTags };
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
            structuredContent: boardData,
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
      },
    };
  }

  private createCreateBoardTool(): Tool {
    return {
      name: 'create_board',
      title: 'Create New Board',
      description: 'Create a new kanban board',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the board',
          },
          description: {
            type: 'string',
            description: 'Optional description of the board',
          },
          color: {
            type: 'string',
            description: 'Hex color code for the board (e.g., #6366f1)',
            pattern: '^#[0-9A-Fa-f]{6}$',
          },
        },
        required: ['name'],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const input = CreateBoardSchema.parse(args);
          const board = await this.db.createBoard({
            name: input.name,
            description: input.description ?? null,
            color: input.color,
          });

          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully created board "${board.name}" (ID: ${board.id})`,
              },
            ],
            structuredContent: board,
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
      },
    };
  }

  private createUpdateBoardTool(): Tool {
    return {
      name: 'update_board',
      title: 'Update Board',
      description: 'Update an existing kanban board',
      inputSchema: {
        type: 'object',
        properties: {
          board_id: {
            type: 'number',
            description: 'ID of the board to update',
          },
          name: {
            type: 'string',
            description: 'New name for the board',
          },
          description: {
            type: 'string',
            description: 'New description for the board',
          },
          color: {
            type: 'string',
            description: 'New hex color code for the board',
            pattern: '^#[0-9A-Fa-f]{6}$',
          },
        },
        required: ['board_id'],
      },
      handler: async (args): Promise<ToolResult> => {
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
            structuredContent: board,
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
      },
    };
  }

  private createDeleteBoardTool(): Tool {
    return {
      name: 'delete_board',
      title: 'Delete Board',
      description: 'Delete a kanban board and all its columns and cards',
      inputSchema: {
        type: 'object',
        properties: {
          board_id: {
            type: 'number',
            description: 'ID of the board to delete',
          },
        },
        required: ['board_id'],
      },
      handler: async (args): Promise<ToolResult> => {
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
      },
    };
  }

  private createCreateColumnTool(): Tool {
    return {
      name: 'create_column',
      title: 'Create Column',
      description: 'Create a new column in a kanban board',
      inputSchema: {
        type: 'object',
        properties: {
          board_id: {
            type: 'number',
            description: 'ID of the board to add the column to',
          },
          name: {
            type: 'string',
            description: 'Name of the column',
          },
          position: {
            type: 'number',
            description: 'Position of the column (0-based)',
          },
          color: {
            type: 'string',
            description: 'Hex color code for the column',
            pattern: '^#[0-9A-Fa-f]{6}$',
          },
        },
        required: ['board_id', 'name'],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const input = CreateColumnSchema.parse(args);
          const column = await this.db.createColumn(input);

          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully created column "${column.name}" (ID: ${column.id})`,
              },
            ],
            structuredContent: column,
          };
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
      },
    };
  }

  private createUpdateColumnTool(): Tool {
    return {
      name: 'update_column',
      title: 'Update Column',
      description: 'Update an existing column',
      inputSchema: {
        type: 'object',
        properties: {
          column_id: {
            type: 'number',
            description: 'ID of the column to update',
          },
          name: {
            type: 'string',
            description: 'New name for the column',
          },
          position: {
            type: 'number',
            description: 'New position for the column',
          },
          color: {
            type: 'string',
            description: 'New hex color code for the column',
            pattern: '^#[0-9A-Fa-f]{6}$',
          },
        },
        required: ['column_id'],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const { column_id, ...updates } = args;
          const input = UpdateColumnSchema.parse(updates);
          const column = await this.db.updateColumn(column_id, input);

          if (!column) {
            throw new NotFoundError('Column', column_id);
          }

          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully updated column "${column.name}" (ID: ${column.id})`,
              },
            ],
            structuredContent: column,
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
      },
    };
  }

  private createDeleteColumnTool(): Tool {
    return {
      name: 'delete_column',
      title: 'Delete Column',
      description: 'Delete a column and all its cards',
      inputSchema: {
        type: 'object',
        properties: {
          column_id: {
            type: 'number',
            description: 'ID of the column to delete',
          },
        },
        required: ['column_id'],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const { column_id } = args;
          const deleted = await this.db.deleteColumn(column_id);

          if (!deleted) {
            throw new NotFoundError('Column', column_id);
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
      },
    };
  }

  private createCreateCardTool(): Tool {
    return {
      name: 'create_card',
      title: 'Create Card',
      description: 'Create a new card in a column',
      inputSchema: {
        type: 'object',
        properties: {
          board_id: {
            type: 'number',
            description: 'ID of the board',
          },
          column_id: {
            type: 'number',
            description: 'ID of the column to add the card to',
          },
          title: {
            type: 'string',
            description: 'Title of the card',
          },
          description: {
            type: 'string',
            description: 'Optional description of the card',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Priority level of the card',
          },
          assigned_to: {
            type: 'string',
            description: 'Person assigned to the card',
          },
          due_date: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            description: 'Due date in YYYY-MM-DD format',
          },
        },
        required: ['board_id', 'column_id', 'title'],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const input = CreateCardSchema.parse(args);
          const card = await this.db.createCard({
            board_id: input.board_id,
            column_id: input.column_id,
            title: input.title,
            description: input.description ?? null,
            position: input.position,
            priority: input.priority,
            assigned_to: input.assigned_to ?? null,
            due_date: input.due_date ?? null,
          });

          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully created card "${card.title}" (ID: ${card.id})`,
              },
            ],
            structuredContent: card,
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
      },
    };
  }

  private createUpdateCardTool(): Tool {
    return {
      name: 'update_card',
      title: 'Update Card',
      description: 'Update an existing card',
      inputSchema: {
        type: 'object',
        properties: {
          card_id: {
            type: 'number',
            description: 'ID of the card to update',
          },
          title: {
            type: 'string',
            description: 'New title for the card',
          },
          description: {
            type: 'string',
            description: 'New description for the card',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'New priority level',
          },
          assigned_to: {
            type: 'string',
            description: 'New assignee',
          },
          due_date: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            description: 'New due date in YYYY-MM-DD format',
          },
        },
        required: ['card_id'],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const { card_id, ...updates } = args;
          const input = UpdateCardSchema.parse(updates);
          const card = await this.db.updateCard(card_id, input);

          if (!card) {
            throw new NotFoundError('Card', card_id);
          }

          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully updated card "${card.title}" (ID: ${card.id})`,
              },
            ],
            structuredContent: card,
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
      },
    };
  }

  private createMoveCardTool(): Tool {
    return {
      name: 'move_card',
      title: 'Move Card',
      description: 'Move a card to a different column or position',
      inputSchema: {
        type: 'object',
        properties: {
          card_id: {
            type: 'number',
            description: 'ID of the card to move',
          },
          column_id: {
            type: 'number',
            description: 'ID of the destination column',
          },
          position: {
            type: 'number',
            description: 'New position in the column (0-based)',
          },
        },
        required: ['card_id', 'column_id', 'position'],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const { card_id, column_id, position } = MoveCardSchema.parse(args);
          const card = await this.db.moveCard(card_id, column_id, position);

          if (!card) {
            throw new NotFoundError('Card', card_id);
          }

          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully moved card "${card.title}" to column ${column_id} at position ${position}`,
              },
            ],
            structuredContent: card,
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
      },
    };
  }

  private createDeleteCardTool(): Tool {
    return {
      name: 'delete_card',
      title: 'Delete Card',
      description: 'Delete a card',
      inputSchema: {
        type: 'object',
        properties: {
          card_id: {
            type: 'number',
            description: 'ID of the card to delete',
          },
        },
        required: ['card_id'],
      },
      handler: async (args): Promise<ToolResult> => {
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
      },
    };
  }

  private createGetTagsTool(): Tool {
    return {
      name: 'get_tags',
      title: 'Get All Tags',
      description: 'Retrieve all available tags',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async (): Promise<ToolResult> => {
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
            structuredContent: tags,
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
      },
    };
  }

  private createCreateTagTool(): Tool {
    return {
      name: 'create_tag',
      title: 'Create Tag',
      description: 'Create a new tag',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the tag',
          },
          color: {
            type: 'string',
            description: 'Hex color code for the tag',
            pattern: '^#[0-9A-Fa-f]{6}$',
          },
        },
        required: ['name'],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const input = CreateTagSchema.parse(args);
          const tag = await this.db.createTag(input);

          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully created tag "${tag.name}" (ID: ${tag.id})`,
              },
            ],
            structuredContent: tag,
          };
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
      },
    };
  }

  private createAddCardTagTool(): Tool {
    return {
      name: 'add_card_tag',
      title: 'Add Tag to Card',
      description: 'Add a tag to a card',
      inputSchema: {
        type: 'object',
        properties: {
          card_id: {
            type: 'number',
            description: 'ID of the card',
          },
          tag_id: {
            type: 'number',
            description: 'ID of the tag to add',
          },
        },
        required: ['card_id', 'tag_id'],
      },
      handler: async (args): Promise<ToolResult> => {
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
      },
    };
  }

  private createRemoveCardTagTool(): Tool {
    return {
      name: 'remove_card_tag',
      title: 'Remove Tag from Card',
      description: 'Remove a tag from a card',
      inputSchema: {
        type: 'object',
        properties: {
          card_id: {
            type: 'number',
            description: 'ID of the card',
          },
          tag_id: {
            type: 'number',
            description: 'ID of the tag to remove',
          },
        },
        required: ['card_id', 'tag_id'],
      },
      handler: async (args): Promise<ToolResult> => {
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
      },
    };
  }

  private createAddCommentTool(): Tool {
    return {
      name: 'add_comment',
      title: 'Add Comment',
      description: 'Add a comment to a card',
      inputSchema: {
        type: 'object',
        properties: {
          card_id: {
            type: 'number',
            description: 'ID of the card',
          },
          content: {
            type: 'string',
            description: 'Comment content',
          },
          author: {
            type: 'string',
            description: 'Author of the comment',
          },
        },
        required: ['card_id', 'content'],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const input = CreateCommentSchema.parse(args);
          const comment = await this.db.addComment({
            card_id: input.card_id,
            content: input.content,
            author: input.author ?? null,
          });

          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully added comment to card ${comment.card_id}`,
              },
            ],
            structuredContent: comment,
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
      },
    };
  }

  private createGetCommentsTool(): Tool {
    return {
      name: 'get_comments',
      title: 'Get Card Comments',
      description: 'Get all comments for a card',
      inputSchema: {
        type: 'object',
        properties: {
          card_id: {
            type: 'number',
            description: 'ID of the card',
          },
        },
        required: ['card_id'],
      },
      handler: async (args): Promise<ToolResult> => {
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
            structuredContent: comments,
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
      },
    };
  }

  private createDeleteCommentTool(): Tool {
    return {
      name: 'delete_comment',
      title: 'Delete Comment',
      description: 'Delete a comment',
      inputSchema: {
        type: 'object',
        properties: {
          comment_id: {
            type: 'number',
            description: 'ID of the comment to delete',
          },
        },
        required: ['comment_id'],
      },
      handler: async (args): Promise<ToolResult> => {
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
      },
    };
  }

  private createGetStatsTool(): Tool {
    return {
      name: 'get_stats',
      title: 'Get Kanban Statistics',
      description: 'Get analytics and statistics for the kanban system',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async (): Promise<ToolResult> => {
        try {
          const boards = await this.db.getBoards();
          const allCards = await Promise.all(
            boards.map(board => this.db.getCardsByBoard(board.id))
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
            structuredContent: stats,
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
      },
    };
  }

  private createSearchCardsTool(): Tool {
    return {
      name: 'search_cards',
      title: 'Search Cards',
      description: 'Search for cards by title, description, or assignee',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          board_id: {
            type: 'number',
            description: 'Optional: limit search to specific board',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Optional: filter by priority',
          },
          assigned_to: {
            type: 'string',
            description: 'Optional: filter by assignee',
          },
        },
        required: ['query'],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const { query, board_id, priority, assigned_to } = args;
          
          // Simple search implementation - in a real app you'd want full-text search
          let cards: Card[];
          if (board_id) {
            cards = await this.db.getCardsByBoard(board_id);
          } else {
            const boards = await this.db.getBoards();
            const allCards = await Promise.all(
              boards.map(board => this.db.getCardsByBoard(board.id))
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
            structuredContent: filteredCards,
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
      },
    };
  }
}