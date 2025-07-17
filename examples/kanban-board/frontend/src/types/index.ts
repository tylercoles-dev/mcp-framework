export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Board {
  id: number;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  color: string;
  created_at: string;
  cards: Card[];
}

export interface Card {
  id: number;
  board_id: number;
  column_id: number;
  title: string;
  description: string | null;
  position: number;
  priority: Priority;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Comment {
  id: number;
  card_id: number;
  content: string;
  author: string | null;
  created_at: string;
}

export interface KanbanBoardData {
  board: Board;
  columns: Column[];
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'audio';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  structuredContent?: any;
  isError?: boolean;
}