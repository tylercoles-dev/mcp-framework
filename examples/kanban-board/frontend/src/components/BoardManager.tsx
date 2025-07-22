import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Manage Board</h3>
          <button onClick={onClose} className="btn-close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="board-name" className="form-label">Board Name *</label>
              <input
                id="board-name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter board name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="board-description" className="form-label">Description</label>
              <textarea
                id="board-description"
                className="form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter board description (optional)"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="board-color" className="form-label">Board Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                <input
                  id="board-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: '60px',
                    height: '40px',
                    border: '2px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    backgroundColor: 'transparent'
                  }}
                />
                <span style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '0.875rem',
                  color: 'var(--color-text-secondary)',
                  background: 'var(--color-bg-tertiary)',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)'
                }}>
                  {color}
                </span>
              </div>
            </div>

            {/* Danger Zone */}
            <div style={{ 
              marginTop: 'var(--spacing-xl)',
              padding: 'var(--spacing-lg)',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <h4 style={{ 
                color: 'var(--color-danger)', 
                fontSize: '1rem', 
                fontWeight: '600', 
                marginBottom: 'var(--spacing-sm)' 
              }}>
                Danger Zone
              </h4>
              <p style={{ 
                color: 'var(--color-text-secondary)', 
                fontSize: '0.875rem',
                marginBottom: 'var(--spacing-md)'
              }}>
                Deleting a board will permanently remove all columns and cards. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="btn btn-danger"
                >
                  {showDeleteConfirm ? 'Confirm Delete Board' : 'Delete Board'}
                </button>
                {showDeleteConfirm && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="btn btn-secondary"
                  >
                    Cancel Delete
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <div></div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
                Update Board
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}