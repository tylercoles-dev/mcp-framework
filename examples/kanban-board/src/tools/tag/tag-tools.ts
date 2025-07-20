import { MCPServer, ToolResult } from '@tylercoles/mcp-server';
import { BaseTool } from '../base-tool.js';
import {
  CreateTagSchema,
  CardTagSchema,
  EmptySchema,
  ValidationError,
} from '../../types/index.js';

export class TagTools extends BaseTool {
  registerTools(server: MCPServer): void {
    this.registerGetTagsTool(server);
    this.registerCreateTagTool(server);
    this.registerAddCardTagTool(server);
    this.registerRemoveCardTagTool(server);
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
        return this.createErrorResult(error);
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

          return this.createSuccessResult(`✅ Successfully created tag "${tag.name}" (ID: ${tag.id})`);
        }
        else
          throw input.error;
      } catch (error) {
        return this.createErrorResult(error);
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

        return this.createSuccessResult(`✅ Successfully added tag ${tag_id} to card ${card_id}`);
      } catch (error) {
        return this.createErrorResult(error);
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

        return this.createSuccessResult(`✅ Successfully removed tag ${tag_id} from card ${card_id}`);
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }
}