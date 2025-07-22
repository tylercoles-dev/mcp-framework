import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface CreateBoardProps {
  onCreateBoard: (name: string, description: string, color: string) => void;
  onCancel: () => void;
}

export const CreateBoard: React.FC<CreateBoardProps> = ({
  onCreateBoard,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');

  const colorOptions = [
    { value: '#6366f1', name: 'Indigo' },
    { value: '#10b981', name: 'Emerald' },
    { value: '#f59e0b', name: 'Amber' },
    { value: '#ef4444', name: 'Red' },
    { value: '#8b5cf6', name: 'Violet' },
    { value: '#06b6d4', name: 'Cyan' },
    { value: '#84cc16', name: 'Lime' },
    { value: '#f97316', name: 'Orange' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateBoard(name.trim(), description.trim(), color);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Create New Board</h3>
          <button className="btn-close" onClick={onCancel}>
            ✕
          </button>
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
                autoFocus
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
              <label className="form-label">Board Color</label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)', 
                gap: 'var(--spacing-sm)',
                marginTop: 'var(--spacing-xs)'
              }}>
                {colorOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-lg)',
                      border: color === option.value ? '3px solid var(--color-text-primary)' : '2px solid var(--color-border)',
                      backgroundColor: option.value,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      transform: color === option.value ? 'scale(1.1)' : 'scale(1)',
                      boxShadow: color === option.value ? 'var(--shadow-md)' : 'var(--shadow-xs)'
                    }}
                    onClick={() => setColor(option.value)}
                    title={option.name}
                  />
                ))}
              </div>
              <div style={{
                marginTop: 'var(--spacing-sm)',
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
                textAlign: 'center'
              }}>
                Selected: {colorOptions.find(opt => opt.value === color)?.name}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <div></div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button type="button" className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
                Create Board
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};