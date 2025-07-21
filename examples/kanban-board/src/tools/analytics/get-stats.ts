import { EmptySchema, ToolResult, createErrorResult, ToolModule } from '@tylercoles/mcp-server';
import { KanbanStats } from '../../types/index.js';
import { KanbanDatabase } from '../../database/index.js';


export const registerGetStatsTool = (db: KanbanDatabase): ToolModule => ({
  name: 'get_stats',
  config: {
    title: 'Get Kanban Statistics',
    description: 'Get analytics and statistics for the kanban system',
    inputSchema: EmptySchema,
  },
  handler: async (): Promise<ToolResult> => {
    try {
      const boards = await db.getBoards();
      const allCards = await Promise.all(
        boards.map(board => db.getCardsByBoard(board.id!))
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
      return createErrorResult(error);
    }
  }
});