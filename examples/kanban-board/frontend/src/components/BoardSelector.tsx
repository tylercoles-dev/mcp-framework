import React, { useState, useRef, useEffect } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedBoardData = boards.find(board => board.id === selectedBoard);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBoardSelect = (boardId: number) => {
    onSelectBoard(boardId);
    setIsOpen(false);
  };

  return (
    <div className="board-selector" ref={dropdownRef}>
      <button
        className="btn btn-secondary board-select-button"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span>{selectedBoardData ? selectedBoardData.name : 'Select a board'}</span>
        <span className="board-select-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      
      {isOpen && (
        <div className="board-select-dropdown">
          {boards.map((board) => (
            <button
              key={board.id}
              className={`board-option ${board.id === selectedBoard ? 'selected' : ''}`}
              onClick={() => handleBoardSelect(board.id)}
              type="button"
            >
              {board.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};