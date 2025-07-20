import { MCPServer, ToolResult } from '@tylercoles/mcp-server';
import { BaseTool } from '../base-tool.js';
import {
  CreateCommentSchema,
  CardIdSchema,
  CommentIdSchema,
  NotFoundError,
} from '../../types/index.js';

export class CommentTools extends BaseTool {
  registerTools(server: MCPServer): void {
    this.registerAddCommentTool(server);
    this.registerGetCommentsTool(server);
    this.registerDeleteCommentTool(server);
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

        return this.createSuccessResult(`✅ Successfully added comment to card ${comment.card_id}`);
      } catch (error) {
        return this.createErrorResult(error);
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
        return this.createErrorResult(error);
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

        return this.createSuccessResult(`✅ Successfully deleted comment (ID: ${comment_id})`);
      } catch (error) {
        return this.createErrorResult(error);
      }
    });
  }
}