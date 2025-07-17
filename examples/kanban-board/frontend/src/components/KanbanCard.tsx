import React, { useState } from 'react';
import { Card } from '../types';

interface KanbanCardProps {
  card: Card;
  columnId: number;
  position: number;
  onMoveCard: (cardId: number, columnId: number, position: number) => void;
  onUpdateCard: (cardId: number, updates: any) => void;
  onDeleteCard: (cardId: number) => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  card,
  columnId,
  position,
  onMoveCard,
  onUpdateCard,
  onDeleteCard,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDescription, setEditDescription] = useState(card.description || '');

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        cardId: card.id,
        sourceColumnId: columnId,
        sourcePosition: position,
      })
    );
  };

  const handleSaveEdit = () => {
    if (editTitle.trim()) {
      onUpdateCard(card.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
      });
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditTitle(card.title);
    setEditDescription(card.description || '');
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this card?')) {
      onDeleteCard(card.id);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isOverdue = card.due_date && new Date(card.due_date) < new Date();

  return (
    <div
      className={`kanban-card ${isOverdue ? 'overdue' : ''}`}
      draggable={!isEditing}
      onDragStart={handleDragStart}
    >
      <div className="card-header">
        <div 
          className="priority-indicator"
          style={{ backgroundColor: getPriorityColor(card.priority) }}
          title={`Priority: ${card.priority}`}
        />
        <div className="card-actions">
          <button
            className="btn-icon"
            onClick={() => setIsEditing(true)}
            title="Edit card"
          >
            ✏️
          </button>
          <button
            className="btn-icon"
            onClick={handleDelete}
            title="Delete card"
          >
            🗑️
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="card-edit">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="edit-title"
            placeholder="Card title"
            autoFocus
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            className="edit-description"
            placeholder="Card description (optional)"
            rows={3}
          />
          <div className="edit-actions">
            <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>
              Save
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleCancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="card-content">
          <h4 className="card-title">{card.title}</h4>
          {card.description && (
            <p className="card-description">{card.description}</p>
          )}
          
          <div className="card-meta">
            {card.assigned_to && (
              <div className="assignee">
                👤 {card.assigned_to}
              </div>
            )}
            
            {card.due_date && (
              <div className={`due-date ${isOverdue ? 'overdue' : ''}`}>
                📅 {formatDate(card.due_date)}
              </div>
            )}
            
            {card.tags.length > 0 && (
              <div className="tags">
                {card.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="tag"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};