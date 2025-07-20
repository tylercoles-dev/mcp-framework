import React, { useState } from 'react';
import { Card, Tag, Comment } from '../types';
import { CardEditor } from './CardEditor';

interface KanbanCardProps {
  card: Card;
  columnId: number;
  position: number;
  availableTags: Tag[];
  comments: Comment[];
  onMoveCard: (cardId: number, columnId: number, position: number) => void;
  onUpdateCard: (cardId: number, updates: any) => void;
  onDeleteCard: (cardId: number) => void;
  onAddComment: (cardId: number, content: string, author?: string) => void;
  onDeleteComment: (commentId: number) => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  card,
  columnId,
  position,
  availableTags,
  comments,
  onMoveCard,
  onUpdateCard,
  onDeleteCard,
  onAddComment,
  onDeleteComment,
}) => {
  const [showEditor, setShowEditor] = useState(false);

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

  const handleOpenEditor = () => {
    setShowEditor(true);
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
    <>
      <div
        className={`kanban-card ${isOverdue ? 'overdue' : ''}`}
        draggable={true}
        onDragStart={handleDragStart}
        onClick={handleOpenEditor}
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
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEditor();
              }}
              title="Edit card"
            >
              ✏️
            </button>
          </div>
        </div>

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

            {comments.length > 0 && (
              <div className="comment-indicator">
                💬 {comments.length} comment{comments.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditor && (
        <CardEditor
          card={card}
          availableTags={availableTags}
          comments={comments}
          onSave={onUpdateCard}
          onDelete={onDeleteCard}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  );
};