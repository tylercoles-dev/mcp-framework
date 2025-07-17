import React from 'react';
import { Board } from '../types';

interface BoardSelectorProps {
  boards: Board[];
  selectedBoard: number | null;
  onSelectBoard: (boardId: number) => void;
}

export const BoardSelector: React.FC<BoardSelectorProps> = ({
  boards,
  selectedBoard,
  onSelectBoard,
}) => {
  return (
    <div className="board-selector">
      <select
        value={selectedBoard || ''}
        onChange={(e) => onSelectBoard(parseInt(e.target.value))}
        className="board-select"
      >
        <option value="" disabled>
          Select a board
        </option>
        {boards.map((board) => (
          <option key={board.id} value={board.id}>
            {board.name}
          </option>
        ))}
      </select>
    </div>
  );
};