import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, Tag, Comment } from '../types';
import { CardView } from './CardView';

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
  const [showViewer, setShowViewer] = useState(false);

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

  const handleOpenViewer = () => {
    setShowViewer(true);
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
        className={`card ${isOverdue ? 'overdue' : ''}`}
        draggable={true}
        onDragStart={handleDragStart}
        onClick={handleOpenViewer}
      >
        <div className="card-header">
          <div 
            className={`card-priority-indicator priority-${card.priority}`}
            title={`Priority: ${card.priority}`}
          />
          <div className="card-actions">
            <button
              className="btn-icon"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenViewer();
              }}
              title="View card"
            >
              👁️
            </button>
          </div>
        </div>

        <h4 className="card-title">{card.title}</h4>
        
        {card.description && (
          <div className="card-description">
            <ReactMarkdown
              components={{
                // Override components to ensure they fit within card layout
                h1: ({ children }) => <h4 style={{ fontSize: '1.1em', margin: '0.5em 0 0.3em 0' }}>{children}</h4>,
                h2: ({ children }) => <h5 style={{ fontSize: '1.05em', margin: '0.4em 0 0.2em 0' }}>{children}</h5>,
                h3: ({ children }) => <h6 style={{ fontSize: '1em', margin: '0.3em 0 0.2em 0' }}>{children}</h6>,
                p: ({ children }) => <p style={{ margin: '0.3em 0' }}>{children}</p>,
                ul: ({ children }) => <ul style={{ margin: '0.3em 0', paddingLeft: '1.2em' }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ margin: '0.3em 0', paddingLeft: '1.2em' }}>{children}</ol>,
                code: ({ children }) => <code style={{ background: '#f4f4f4', padding: '0.1em 0.3em', borderRadius: '3px' }}>{children}</code>,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>{children}</a>
              }}
            >
              {card.description}
            </ReactMarkdown>
          </div>
        )}
        
        <div className="card-meta">
          {card.assigned_to && (
            <div className="card-assignee">
              👤 {card.assigned_to}
            </div>
          )}
          
          {card.due_date && (
            <div className={`card-due-date ${isOverdue ? 'overdue' : ''}`}>
              📅 {formatDate(card.due_date)}
            </div>
          )}
          
          {card.tags.length > 0 && (
            <div className="card-tags">
              {card.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="card-tag"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {comments.length > 0 && (
            <div className="card-comments">
              💬 {comments.length} comment{comments.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {showViewer && (
        <CardView
          card={card}
          availableTags={availableTags}
          comments={comments}
          onSave={onUpdateCard}
          onDelete={onDeleteCard}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
          onClose={() => setShowViewer(false)}
        />
      )}
    </>
  );
};