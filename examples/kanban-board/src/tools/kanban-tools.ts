import { MCPServer } from '@tylercoles/mcp-server';
import { KanbanDatabase } from '../database/index.js';
import { KanbanWebSocketServer } from '../websocket-server.js';
import {
  BoardTools,
  ColumnTools,
  CardTools,
  TagTools,
  CommentTools,
  AnalyticsTools,
} from './index.js';

export class KanbanTools {
  private boardTools: BoardTools;
  private columnTools: ColumnTools;
  private cardTools: CardTools;
  private tagTools: TagTools;
  private commentTools: CommentTools;
  private analyticsTools: AnalyticsTools;

  constructor(
    private db: KanbanDatabase,
    private wsServer?: KanbanWebSocketServer
  ) {
    this.boardTools = new BoardTools(db, wsServer);
    this.columnTools = new ColumnTools(db, wsServer);
    this.cardTools = new CardTools(db, wsServer);
    this.tagTools = new TagTools(db, wsServer);
    this.commentTools = new CommentTools(db, wsServer);
    this.analyticsTools = new AnalyticsTools(db, wsServer);
  }

  registerTools(server: MCPServer) {
    // Register all tool categories
    this.boardTools.registerTools(server);
    this.columnTools.registerTools(server);
    this.cardTools.registerTools(server);
    this.tagTools.registerTools(server);
    this.commentTools.registerTools(server);
    this.analyticsTools.registerTools(server);
  }
}