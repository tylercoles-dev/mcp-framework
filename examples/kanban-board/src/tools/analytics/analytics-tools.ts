import { MCPServer, ToolResult } from '@tylercoles/mcp-server';
import { BaseTool } from '../base-tool.js';
import {
  SearchCardsSchema,
  EmptySchema,
  KanbanStats,
} from '../../types/index.js';
import { Card } from '../../database/index.js';

export class AnalyticsTools extends BaseTool {
  registerTools(server: MCPServer): void {
    this.registerGetStatsTool(server);
    this.registerSearchCardsTool(server);
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
        return this.createErrorResult(error);
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
        return this.createErrorResult(error);
      }
    });
  }
}