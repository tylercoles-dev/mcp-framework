import React, { useState } from 'react';
import { Board } from '../types';

interface BoardManagerProps {
  board: Board;
  onUpdateBoard: (boardId: number, updates: Partial<Board>) => void;
  onDeleteBoard: (boardId: number) => void;
  onClose: () => void;
}

export function BoardManager({ board, onUpdateBoard, onDeleteBoard, onClose }: BoardManagerProps) {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description || '');
  const [color, setColor] = useState(board.color || '#3b82f6');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onUpdateBoard(board.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
      onClose();
    }
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDeleteBoard(board.id);
      onClose();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Manage Board</h2>
          <button onClick={onClose} className="btn-close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="board-manager-form">
          <div className="form-group">
            <label htmlFor="board-name">Board Name</label>
            <input
              id="board-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter board name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="board-description">Description</label>
            <textarea
              id="board-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter board description (optional)"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="board-color">Color</label>
            <div className="color-picker">
              <input
                id="board-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
              <span className="color-value">{color}</span>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Update Board
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>

        <div className="danger-zone">
          <h3>Danger Zone</h3>
          <p>Deleting a board will permanently remove all columns and cards.</p>
          <button
            onClick={handleDelete}
            className={`btn ${showDeleteConfirm ? 'btn-danger-confirm' : 'btn-danger'}`}
          >
            {showDeleteConfirm ? 'Confirm Delete' : 'Delete Board'}
          </button>
          {showDeleteConfirm && (
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="btn btn-secondary"
              style={{ marginLeft: '10px' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}