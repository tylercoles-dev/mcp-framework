#!/usr/bin/env node

import { MCPServer } from '@tylercoles/mcp-server';
import { HttpTransport } from '@tylercoles/mcp-transport-http';
import { KanbanDatabase, DatabaseConfig } from './database/index.js';
import { KanbanTools } from './tools/kanban-tools.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
  port: parseInt(process.env.PORT || '3001'),
  host: process.env.HOST || 'localhost',
  database: {
    type: (process.env.DB_TYPE as 'sqlite' | 'postgres' | 'mysql') || 'sqlite',
    filename: process.env.DB_FILE || path.join(__dirname, '../kanban.db'),
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  } as DatabaseConfig,
};

async function createKanbanServer() {
  // Initialize database
  console.log('🔧 Initializing database...');
  const db = new KanbanDatabase(config.database);
  await db.initialize();
  console.log('✅ Database initialized');

  // Create MCP server
  const server = new MCPServer({
    name: 'kanban-board',
    version: '1.0.0',
  });

  // Setup tools
  const kanbanTools = new KanbanTools(db);
  kanbanTools.registerTools(server);

  // Add resources for board data access
  server.registerResource('all-boards', 'kanban://boards', {
    title: 'All Boards',
    description: 'List of all kanban boards',
    mimeType: 'application/json',
  }, async () => {
    const boards = await db.getBoards();
    return {
      contents: [{
        uri: 'kanban://boards',
        mimeType: 'application/json',
        text: JSON.stringify(boards, null, 2),
      }]
    };
  });

  server.registerResourceTemplate('board-details', 'kanban://board/{board_id}', {
    title: 'Board Details',
    description: 'Detailed information about a specific board',
    mimeType: 'application/json',
  }, async (uri: any) => {
    const match = uri.match(/kanban:\/\/board\/(\d+)/);
    if (!match) {
      throw new Error('Invalid board URI format');
    }
    
    const boardId = parseInt(match[1]);
    const board = await db.getBoardById(boardId);
    if (!board) {
      throw new Error(`Board ${boardId} not found`);
    }

    const columns = await db.getColumnsByBoard(boardId);
    const boardData = {
      board,
      columns: await Promise.all(
        columns.map(async (column) => {
          const cards = await db.getCardsByColumn(column.id!);
          const cardsWithTags = await Promise.all(
            cards.map(async (card) => {
              const tags = await db.getCardTags(card.id!);
              return { ...card, tags };
            })
          );
          return { ...column, cards: cardsWithTags };
        })
      ),
    };

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(boardData, null, 2),
      }]
    };
  });

  server.registerResource('kanban-stats', 'kanban://stats', {
    title: 'Kanban Statistics',
    description: 'Analytics and statistics for the kanban system',
    mimeType: 'application/json',
  }, async () => {
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

    const stats = {
      total_boards: boards.length,
      total_cards: allCards.length,
      cards_by_priority: cardsByPriority,
      overdue_cards: overdueCards,
      generated_at: new Date().toISOString(),
    };

    return {
      contents: [{
        uri: 'kanban://stats',
        mimeType: 'application/json',
        text: JSON.stringify(stats, null, 2),
      }]
    };
  });

  // Add prompts for common workflows
  server.registerPrompt('create_project_board', {
    title: 'Create Project Board',
    description: 'Create a new project board with standard columns',
    argsSchema: {
      type: 'object',
      properties: {
        project_name: {
          type: 'string',
          description: 'Name of the project'
        },
        description: {
          type: 'string',
          description: 'Project description'
        }
      },
      required: ['project_name']
    },
  }, (args: any) => {
    const { project_name, description } = args;
    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Please create a new kanban board for the project "${project_name}"${description ? ` with description: ${description}` : ''}. After creating the board, add the standard columns: "To Do", "In Progress", "Review", and "Done". Use appropriate colors for each column.`,
          },
        },
      ],
    };
  });

  server.registerPrompt('daily_standup', {
    title: 'Daily Standup Report',
    description: 'Generate a daily standup report for a board',
    argsSchema: {
      type: 'object',
      properties: {
        board_id: {
          type: 'string',
          description: 'ID of the board to report on'
        }
      },
      required: ['board_id']
    },
  }, (args: any) => {
    const { board_id } = args;
    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Generate a daily standup report for board ${board_id}. Include:
1. Cards completed yesterday (moved to "Done" column)
2. Cards in progress today ("In Progress" column)
3. Any blocked or overdue cards
4. Summary of team workload and priorities

Please use the get_board tool to fetch the current board state and analyze the data.`,
          },
        },
      ],
    };
  });

  server.registerPrompt('sprint_planning', {
    title: 'Sprint Planning Assistant',
    description: 'Help with sprint planning based on board state',
    argsSchema: {
      type: 'object',
      properties: {
        board_id: {
          type: 'string',
          description: 'ID of the board for sprint planning'
        },
        sprint_capacity: {
          type: 'string',
          description: 'Team capacity for the sprint (story points or hours)'
        }
      },
      required: ['board_id']
    },
  }, (args: any) => {
    const { board_id, sprint_capacity } = args;
    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Help me plan the next sprint for board ${board_id}. Please:
1. Get the current board state and analyze the backlog
2. Suggest which cards should be prioritized based on priority levels and due dates
3. Identify any dependencies or blockers
4. ${sprint_capacity ? `Recommend cards that fit within the ${sprint_capacity} capacity` : 'Suggest a reasonable sprint scope'}
5. Highlight any cards that need more detail or clarification

Use the kanban tools to analyze the current state and provide recommendations.`,
          },
        },
      ],
    };
  });

  // Setup HTTP transport
  const httpTransport = new HttpTransport({
    port: config.port,
    host: config.host,
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:5173'], // React dev servers
      credentials: true,
    },
  });

  server.useTransport(httpTransport);

  // Setup graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    await db.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down server...');
    await db.close();
    process.exit(0);
  });

  return { server, db };
}

async function main() {
  try {
    console.log('🚀 Starting Kanban Board MCP Server...');
    console.log(`📊 Database: ${config.database.type}`);
    console.log(`🌐 HTTP Server: http://${config.host}:${config.port}`);
    
    const { server, db } = await createKanbanServer();
    
    await server.start();
    
    console.log('✅ Kanban Board MCP Server is running!');
    console.log('\n📚 Available endpoints:');
    console.log(`   • MCP HTTP: http://${config.host}:${config.port}/mcp`);
    console.log(`   • Health: http://${config.host}:${config.port}/health`);
    console.log(`   • Frontend: http://${config.host}:${config.port}/`);
    console.log('\n🛠️  Available tools:');
    console.log('   • Board management: get_boards, create_board, update_board, delete_board');
    console.log('   • Column management: create_column, update_column, delete_column');
    console.log('   • Card management: create_card, update_card, move_card, delete_card');
    console.log('   • Tags & comments: create_tag, add_card_tag, add_comment');
    console.log('   • Analytics: get_stats, search_cards');
    console.log('\n📋 Available prompts:');
    console.log('   • create_project_board - Set up a new project with standard columns');
    console.log('   • daily_standup - Generate daily standup reports');
    console.log('   • sprint_planning - Sprint planning assistance');
    console.log('\n📚 Available resources:');
    console.log('   • kanban://boards - List all boards');
    console.log('   • kanban://board/{id} - Detailed board data');
    console.log('   • kanban://stats - System statistics');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}