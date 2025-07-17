import React, { useState } from 'react';

interface CreateCardProps {
  onCreateCard: (title: string, description?: string) => void;
  onCancel: () => void;
}

export const CreateCard: React.FC<CreateCardProps> = ({
  onCreateCard,
  onCancel,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onCreateCard(title.trim(), description.trim() || undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="create-card" onKeyDown={handleKeyDown}>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter card title"
          className="card-title-input"
          autoFocus
          required
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter description (optional)"
          className="card-description-input"
          rows={2}
        />
        <div className="create-card-actions">
          <button type="submit" className="btn btn-primary btn-sm">
            Add Card
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};