import { EmptySchema, ToolModule, ToolResult } from '@tylercoles/mcp-server';
import {
  CreateTagSchema,
  CardTagSchema,
  ValidationError,
} from '../../types/index.js';
import { createErrorResult, createSuccessResult } from '@tylercoles/mcp-server/dist/tools.js';
import { KanbanDatabase } from '../../database/index.js';
import { KanbanWebSocketServer } from '../../websocket-server.js';

export const registerGetTagsTool = (db: KanbanDatabase, wsServer: KanbanWebSocketServer): ToolModule => ({
  name: 'get_tags',
  config: {
    title: 'Get All Tags',
    description: 'Retrieve all available tags',
    inputSchema: EmptySchema,
  },
  handler: async (): Promise<ToolResult> => {
    try {
      const tags = await db.getTags();
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
      return createErrorResult(error);
    }
  }
});

export const registerCreateTagTool = (db: KanbanDatabase, wsServer: KanbanWebSocketServer): ToolModule => ({
  name: 'create_tag',
  config: {
    title: 'Create Tag',
    description: 'Create a new tag',
    inputSchema: CreateTagSchema,
  },
  handler: async (args: any): Promise<ToolResult> => {
    try {
      const input = CreateTagSchema.safeParse(args);
      if (input.success) {
        const tag = await db.createTag(input.data as any);

        return createSuccessResult(`✅ Successfully created tag "${tag.name}" (ID: ${tag.id})`);
      }
      else
        throw input.error;
    } catch (error) {
      return createErrorResult(error);
    }
  }
});

export const registerAddCardTagTool = (db: KanbanDatabase, wsServer: KanbanWebSocketServer): ToolModule => ({
  name: 'add_card_tag',
  config: {
    title: 'Add Tag to Card',
    description: 'Add a tag to a card',
    inputSchema: CardTagSchema,
  },
  handler: async (args: any): Promise<ToolResult> => {
    try {
      const { card_id, tag_id } = args;
      await db.addCardTag(card_id, tag_id);

      return createSuccessResult(`✅ Successfully added tag ${tag_id} to card ${card_id}`);
    } catch (error) {
      return createErrorResult(error);
    }
  }
});

export const registerRemoveCardTagTool = (db: KanbanDatabase, wsServer: KanbanWebSocketServer): ToolModule => ({
  name: 'remove_card_tag',
  config: {
    title: 'Remove Tag from Card',
    description: 'Remove a tag from a card',
    inputSchema: CardTagSchema,
  },
  handler: async (args: any): Promise<ToolResult> => {
    try {
      const { card_id, tag_id } = args;
      const removed = await db.removeCardTag(card_id, tag_id);

      if (!removed) {
        throw new ValidationError('Tag not found on card');
      }

      return createSuccessResult(`✅ Successfully removed tag ${tag_id} from card ${card_id}`);
    } catch (error) {
      return createErrorResult(error);
    }
  }
});