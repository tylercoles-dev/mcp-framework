import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { Card, Priority, Tag, Comment } from '../types';
import { getUserSettings, getAutoFillCommentAuthor, updateAutoFillCommentAuthor } from '../utils/localStorage';

interface CardEditorProps {
  card: Card;
  availableTags: Tag[];
  comments: Comment[];
  onSave: (cardId: number, updates: Partial<Card>) => void;
  onDelete: (cardId: number) => void;
  onAddComment: (cardId: number, content: string, author?: string) => void;
  onDeleteComment: (commentId: number) => void;
  onClose: () => void;
}

export const CardEditor: React.FC<CardEditorProps> = ({
  card,
  availableTags,
  comments,
  onSave,
  onDelete,
  onAddComment,
  onDeleteComment,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    title: card.title,
    description: card.description || '',
    priority: card.priority,
    assigned_to: card.assigned_to || '',
    due_date: card.due_date || '',
  });

  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [autoFillAuthor, setAutoFillAuthor] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  // Update comment author when auto-fill setting changes
  useEffect(() => {
    if (autoFillAuthor) {
      const userSettings = getUserSettings();
      if (userSettings.name && !commentAuthor) {
        setCommentAuthor(userSettings.name);
      }
    } else {
      setCommentAuthor('');
    }
  }, [autoFillAuthor]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    if (!formData.title.trim()) return;

    const updates: Partial<Card> = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      priority: formData.priority,
      assigned_to: formData.assigned_to.trim() || null,
      due_date: formData.due_date || null,
    };

    onSave(card.id, updates);
    setHasUnsavedChanges(false);
    onClose();
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    onAddComment(card.id, newComment.trim(), commentAuthor.trim() || undefined);
    setNewComment('');
  };

  const handleAutoFillToggle = (checked: boolean) => {
    setAutoFillAuthor(checked);
    updateAutoFillCommentAuthor(checked);
    
    if (checked) {
      const userSettings = getUserSettings();
      if (userSettings.name) {
        setCommentAuthor(userSettings.name);
      }
    }
  };

  const handleDelete = () => {
    onDelete(card.id);
    onClose();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isOverdue = card.due_date && new Date(card.due_date) < new Date();

  return createPortal(
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal card-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Edit Card</h3>
          <button className="btn-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="card-editor-form">
            {/* Title - Full Width */}
            <div className="form-group">
              <label htmlFor="card-title" className="form-label">Title *</label>
              <input
                id="card-title"
                type="text"
                className="form-input"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Card title"
                required
              />
            </div>

              {/* Description with Markdown Support */}
              <div className="form-group">
                <div className="description-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xs)' }}>
                  <label htmlFor="card-description" className="form-label">Description</label>
                  <div className="tab-buttons" style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${activeTab === 'edit' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setActiveTab('edit')}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${activeTab === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setActiveTab('preview')}
                    >
                      Preview
                    </button>
                  </div>
                </div>
                
                {activeTab === 'edit' ? (
                  <textarea
                    id="card-description"
                    className="form-textarea"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Card description (supports Markdown)"
                    rows={8}
                  />
                ) : (
                  <div className="markdown-preview" style={{ 
                    minHeight: '200px', 
                    padding: 'var(--spacing-md)', 
                    background: 'var(--color-bg-tertiary)', 
                    borderRadius: 'var(--radius-md)', 
                    border: '1px solid var(--color-border)' 
                  }}>
                    {formData.description ? (
                      <ReactMarkdown>{formData.description}</ReactMarkdown>
                    ) : (
                      <p style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>No description to preview</p>
                    )}
                  </div>
                )}
              </div>

              {/* Other Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                {/* Priority */}
                <div className="form-group">
                  <label htmlFor="card-priority" className="form-label">Priority</label>
                  <select
                    id="card-priority"
                    className="form-select"
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value as Priority)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                {/* Assigned To */}
                <div className="form-group">
                  <label htmlFor="card-assigned" className="form-label">Assigned To</label>
                  <input
                    id="card-assigned"
                    type="text"
                    className="form-input"
                    value={formData.assigned_to}
                    onChange={(e) => handleInputChange('assigned_to', e.target.value)}
                    placeholder="Assignee name"
                  />
                </div>
              </div>

              {/* Due Date */}
              <div className="form-group">
                <label htmlFor="card-due-date" className="form-label">Due Date</label>
                <input
                  id="card-due-date"
                  type="date"
                  className="form-input"
                  value={formData.due_date}
                  onChange={(e) => handleInputChange('due_date', e.target.value)}
                />
                {isOverdue && (
                  <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginTop: 'var(--spacing-xs)' }}>
                    ⚠️ This card is overdue
                  </div>
                )}
              </div>

              {/* Tags */}
              {card.tags.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <div className="card-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
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
                </div>
              )}

              {/* Card Meta Info */}
              <div className="form-group">
                <label className="form-label">Card Information</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  <div>
                    <strong>Created:</strong> {formatDate(card.created_at)}
                  </div>
                  <div>
                    <strong>Updated:</strong> {formatDate(card.updated_at)}
                  </div>
                </div>
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
                  value={commentAuthor}
                  onChange={(e) => setCommentAuthor(e.target.value)}
                  placeholder="Your name (optional)"
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
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={3}
                  style={{ flex: '1' }}
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

        {/* Modal Actions */}
        <div className="modal-footer">
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              className={`btn ${showDeleteConfirm ? 'btn-danger' : 'btn-danger'}`}
              onClick={showDeleteConfirm ? handleDelete : () => setShowDeleteConfirm(true)}
            >
              {showDeleteConfirm ? 'Confirm Delete' : 'Delete Card'}
            </button>
            {showDeleteConfirm && (
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel Delete
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button className="btn btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleSave}
              disabled={!formData.title.trim()}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};