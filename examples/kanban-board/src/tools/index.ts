import { MCPServer } from '@tylercoles/mcp-server';
import { KanbanDatabase } from '../database/index.js';
import { KanbanWebSocketServer } from '../websocket-server.js';
import { registerSearchCardsTool } from './analytics/search-cards.js';
import { registerGetStatsTool } from './analytics/get-stats.js';
import { registerCreateBoardTool, registerDeleteBoardTool, registerGetBoardsTool, registerGetBoardTool, registerUpdateBoardTool } from './board/board-tools.js';
import { registerCreateCardTool, registerDeleteCardTool, registerMoveCardTool, registerUpdateCardTool } from './card/card-tools.js';
import { registerCreateColumnTool, registerDeleteColumnTool, registerUpdateColumnTool } from './column/column-tools.js';
import { registerAddCommentTool, registerDeleteCommentTool, registerGetCommentsTool } from './comment/comment-tools.js';
import { registerAddCardTagTool, registerCreateTagTool, registerGetTagsTool, registerRemoveCardTagTool } from './tag/tag-tools.js';

export const registerTools = (server: MCPServer, db: KanbanDatabase, wsServer: KanbanWebSocketServer) => {
  server.registerTool(registerGetStatsTool(db))
  server.registerTool(registerSearchCardsTool(db));

  server.registerTool(registerGetBoardsTool(db));
  server.registerTool(registerGetBoardTool(db));
  server.registerTool(registerCreateBoardTool(db, wsServer));
  server.registerTool(registerUpdateBoardTool(db));
  server.registerTool(registerDeleteBoardTool(db));

  server.registerTool(registerCreateCardTool(db, wsServer));
  server.registerTool(registerUpdateCardTool(db, wsServer));
  server.registerTool(registerMoveCardTool(db, wsServer));
  server.registerTool(registerDeleteCardTool(db, wsServer));

  server.registerTool(registerCreateColumnTool(db, wsServer));
  server.registerTool(registerUpdateColumnTool(db, wsServer));
  server.registerTool(registerDeleteColumnTool(db, wsServer));

  server.registerTool(registerAddCommentTool(db, wsServer));
  server.registerTool(registerGetCommentsTool(db, wsServer));
  server.registerTool(registerDeleteCommentTool(db, wsServer));

  server.registerTool(registerGetTagsTool(db, wsServer));
  server.registerTool(registerCreateTagTool(db, wsServer));
  server.registerTool(registerAddCardTagTool(db, wsServer));
  server.registerTool(registerRemoveCardTagTool(db, wsServer));
}