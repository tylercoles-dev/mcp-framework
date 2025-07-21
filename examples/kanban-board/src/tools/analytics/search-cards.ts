import { ToolHandler, ToolModule, ToolResult } from '@tylercoles/mcp-server';
import { SearchCardsSchema } from '../../types/index.js';
import { Card, KanbanDatabase } from '../../database/index.js';
import { createErrorResult } from '@tylercoles/mcp-server/dist/tools.js';

export const registerSearchCardsTool = (db: KanbanDatabase): ToolModule => ({
  name: 'search_cards',
  config: {
    title: 'Search Cards',
    description: 'Search for cards by title, description, or assignee',
    inputSchema: SearchCardsSchema,
  },
  handler: async (args: any): Promise<ToolResult> => {
    try {
      const { query, board_id, priority, assigned_to } = args;

      // Simple search implementation - in a real app you'd want full-text search
      let cards: Card[];
      if (board_id) {
        cards = await db.getCardsByBoard(board_id);
      } else {
        const boards = await db.getBoards();
        const allCards = await Promise.all(
          boards.map(board => db.getCardsByBoard(board.id!))
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
      return createErrorResult(error);
    }
  }
});
