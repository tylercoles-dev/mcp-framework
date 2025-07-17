import React from 'react';
import { KanbanColumn } from './KanbanColumn';
import { KanbanBoardData } from '../types';

interface KanbanBoardProps {
  boardData: KanbanBoardData;
  onCreateCard: (columnId: number, title: string, description?: string) => void;
  onMoveCard: (cardId: number, columnId: number, position: number) => void;
  onUpdateCard: (cardId: number, updates: any) => void;
  onDeleteCard: (cardId: number) => void;
  loading: boolean;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  boardData,
  onCreateCard,
  onMoveCard,
  onUpdateCard,
  onDeleteCard,
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
            onCreateCard={onCreateCard}
            onMoveCard={onMoveCard}
            onUpdateCard={onUpdateCard}
            onDeleteCard={onDeleteCard}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
};