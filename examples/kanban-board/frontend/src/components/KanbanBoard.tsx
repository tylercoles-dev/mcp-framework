import React from 'react';
import { KanbanColumn } from './KanbanColumn';
import { KanbanBoardData, Tag, Comment } from '../types';

interface KanbanBoardProps {
  boardData: KanbanBoardData;
  availableTags: Tag[];
  commentsData: Record<number, Comment[]>; // cardId -> comments
  onCreateCard: (columnId: number, title: string, description?: string) => void;
  onMoveCard: (cardId: number, columnId: number, position: number) => void;
  onUpdateCard: (cardId: number, updates: any) => void;
  onDeleteCard: (cardId: number) => void;
  onAddComment: (cardId: number, content: string, author?: string) => void;
  onDeleteComment: (commentId: number) => void;
  loading: boolean;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  boardData,
  availableTags,
  commentsData,
  onCreateCard,
  onMoveCard,
  onUpdateCard,
  onDeleteCard,
  onAddComment,
  onDeleteComment,
  loading,
}) => {
  return (
    <div className="kanban-board">
      <div className="board-header" style={{ borderLeft: `4px solid ${boardData.board.color}` }}>
        <h2>{boardData.board.name}</h2>
        {boardData.board.description && (
          <p className="board-description">{boardData.board.description}</p>
        )}
      </div>

      <div className="board-columns">
        {boardData.columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            availableTags={availableTags}
            commentsData={commentsData}
            onCreateCard={onCreateCard}
            onMoveCard={onMoveCard}
            onUpdateCard={onUpdateCard}
            onDeleteCard={onDeleteCard}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
};