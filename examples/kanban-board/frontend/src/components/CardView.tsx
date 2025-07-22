import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { Card, Priority, Tag, Comment } from '../types';
import { CardEditor } from './CardEditor';
import { getUserSettings, getAutoFillCommentAuthor, updateAutoFillCommentAuthor } from '../utils/localStorage';

interface CardViewProps {
  card: Card;
  availableTags: Tag[];
  comments: Comment[];
  onSave: (cardId: number, updates: Partial<Card>) => void;
  onDelete: (cardId: number) => void;
  onAddComment: (cardId: number, content: string, author?: string) => void;
  onDeleteComment: (commentId: number) => void;
  onClose: () => void;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  availableTags,
  comments,
  onSave,
  onDelete,
  onAddComment,
  onDeleteComment,
  onClose,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [autoFillAuthor, setAutoFillAuthor] = useState(true);

  // Initialize auto-fill settings and comment author
  useEffect(() => {
    const autoFillEnabled = getAutoFillCommentAuthor();
    setAutoFillAuthor(autoFillEnabled);
    
    if (autoFillEnabled) {
      const userSettings = getUserSettings();
      if (userSettings.name) {
        setCommentAuthor(userSettings.name);
      }
    }
  }, []);

  const handleAutoFillToggle = (enabled: boolean) => {
    setAutoFillAuthor(enabled);
    updateAutoFillCommentAuthor(enabled);
    
    if (enabled) {
      const userSettings = getUserSettings();
      if (userSettings.name) {
        setCommentAuthor(userSettings.name);
      }
    } else {
      setCommentAuthor('');
    }
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      onAddComment(card.id, newComment.trim(), commentAuthor.trim() || undefined);
      setNewComment('');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getTagColor = (tagName: string) => {
    const tag = availableTags.find(t => t.name === tagName);
    return tag?.color || '#6366f1';
  };

  const cardTags = card.tags || [];

  // If editing mode, render the CardEditor
  if (isEditing) {
    return (
      <CardEditor
        card={card}
        availableTags={availableTags}
        comments={comments}
        onSave={onSave}
        onDelete={onDelete}
        onAddComment={onAddComment}
        onDeleteComment={onDeleteComment}
        onClose={() => setIsEditing(false)}
      />
    );
  }

  // Render view mode
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card-view-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{card.title}</h3>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="modal-body">
          <div className="card-view-content">
            {/* Priority indicator */}
            <div 
              className="card-priority-indicator" 
              style={{ backgroundColor: getPriorityColor(card.priority) }}
            />
            
            <div className="card-view-main">
              {/* Description */}
              {card.description && (
                <div className="card-view-section">
                  <h4 className="section-title">Description</h4>
                  <div className="card-description-view">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <h4 style={{ fontSize: '1.1em', margin: '0.5em 0 0.3em 0' }}>{children}</h4>,
                        h2: ({ children }) => <h5 style={{ fontSize: '1.05em', margin: '0.4em 0 0.25em 0' }}>{children}</h5>,
                        h3: ({ children }) => <h6 style={{ fontSize: '1em', margin: '0.3em 0 0.2em 0' }}>{children}</h6>,
                        p: ({ children }) => <p style={{ margin: '0.5em 0' }}>{children}</p>,
                        ul: ({ children }) => <ul style={{ marginLeft: '1.2em', margin: '0.5em 0' }}>{children}</ul>,
                        ol: ({ children }) => <ol style={{ marginLeft: '1.2em', margin: '0.5em 0' }}>{children}</ol>,
                        blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #ddd', paddingLeft: '1em', margin: '0.5em 0', color: '#666' }}>{children}</blockquote>,
                        code: ({ children }) => <code style={{ backgroundColor: 'var(--color-bg-tertiary)', padding: '0.1em 0.3em', borderRadius: '3px', fontSize: '0.9em' }}>{children}</code>,
                      }}
                    >
                      {card.description}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="card-view-section">
                <h4 className="section-title">Details</h4>
                <div className="card-meta-grid">
                  <div className="meta-item">
                    <span className="meta-label">Priority:</span>
                    <span className="meta-value priority" style={{ color: getPriorityColor(card.priority) }}>
                      {card.priority.charAt(0).toUpperCase() + card.priority.slice(1)}
                    </span>
                  </div>
                  
                  {card.assigned_to && (
                    <div className="meta-item">
                      <span className="meta-label">Assigned to:</span>
                      <span className="meta-value">{card.assigned_to}</span>
                    </div>
                  )}
                  
                  {card.due_date && (
                    <div className="meta-item">
                      <span className="meta-label">Due date:</span>
                      <span className={`meta-value ${isOverdue(card.due_date) ? 'overdue' : ''}`}>
                        {formatDate(card.due_date)}
                      </span>
                    </div>
                  )}
                  
                  <div className="meta-item">
                    <span className="meta-label">Created:</span>
                    <span className="meta-value">{formatDate(card.created_at)}</span>
                  </div>
                  
                  {card.updated_at !== card.created_at && (
                    <div className="meta-item">
                      <span className="meta-label">Updated:</span>
                      <span className="meta-value">{formatDate(card.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              {cardTags.length > 0 && (
                <div className="card-view-section">
                  <h4 className="section-title">Tags</h4>
                  <div className="card-tags-view">
                    {cardTags.map((tagName) => (
                      <span
                        key={tagName}
                        className="card-tag"
                        style={{ backgroundColor: getTagColor(tagName) }}
                      >
                        {tagName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="comments-section">
            <h4 className="section-title">Comments ({comments.length})</h4>
            
            {/* Add Comment */}
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Your name (optional)"
                  value={commentAuthor}
                  onChange={(e) => setCommentAuthor(e.target.value)}
                  disabled={autoFillAuthor}
                  style={{ flex: '1' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={autoFillAuthor}
                    onChange={(e) => handleAutoFillToggle(e.target.checked)}
                  />
                  Auto-fill from profile
                </label>
              </div>
              {autoFillAuthor && !getUserSettings().name && (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--spacing-sm)' }}>
                  💡 Set your name in settings to auto-fill comments
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <textarea
                  className="form-textarea"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  style={{ flex: '1' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleAddComment();
                    }
                  }}
                />
                <button 
                  className="btn btn-primary"
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  style={{ alignSelf: 'flex-end' }}
                >
                  Add Comment
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div>
              {comments.length === 0 ? (
                <div style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--spacing-lg)', fontStyle: 'italic' }}>
                  No comments yet
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} style={{ 
                    background: 'var(--color-bg-tertiary)', 
                    border: '1px solid var(--color-border)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: 'var(--spacing-md)', 
                    marginBottom: 'var(--spacing-sm)' 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xs)' }}>
                      <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>
                        {comment.author || 'Anonymous'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                          {formatDate(comment.created_at)}
                        </span>
                        <button
                          className="btn-icon"
                          onClick={() => onDeleteComment(comment.id)}
                          title="Delete comment"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div style={{ color: 'var(--color-text-secondary)' }}>
                      {comment.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-left">
            <button 
              onClick={() => setIsEditing(true)}
              className="btn btn-primary"
            >
              Edit Card
            </button>
          </div>
          <div className="footer-right">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};