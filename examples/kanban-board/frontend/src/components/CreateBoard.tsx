import React, { useState } from 'react';

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

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Create New Board</h3>
          <button className="btn-icon" onClick={onCancel}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-content">
          <div className="form-group">
            <label htmlFor="board-name">Board Name *</label>
            <input
              id="board-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter board name"
              required
              autoFocus
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
              {colorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`color-option ${color === option.value ? 'selected' : ''}`}
                  style={{ backgroundColor: option.value }}
                  onClick={() => setColor(option.value)}
                  title={option.name}
                />
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">
              Create Board
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};