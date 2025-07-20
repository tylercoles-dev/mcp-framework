import React, { useState, useEffect } from 'react';
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

  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Card</h3>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-content">
          <div className="card-editor-form">
            {/* Title - Full Width */}
            <div className="form-group title-group">
              <label htmlFor="card-title">Title *</label>
              <input
                id="card-title"
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Card title"
                required
              />
            </div>

            {/* Two Column Layout */}
            <div className="card-editor-columns">
              {/* Left Column - Description */}
              <div className="card-editor-left">
                <div className="form-group">
                  <label htmlFor="card-description">Description</label>
                  <textarea
                    id="card-description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Card description"
                    rows={8}
                  />
                </div>
              </div>

              {/* Right Column - All Other Fields */}
              <div className="card-editor-right">
                {/* Priority */}
                <div className="form-group">
                  <label htmlFor="card-priority">Priority</label>
                  <select
                    id="card-priority"
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
                  <label htmlFor="card-assigned">Assigned To</label>
                  <input
                    id="card-assigned"
                    type="text"
                    value={formData.assigned_to}
                    onChange={(e) => handleInputChange('assigned_to', e.target.value)}
                    placeholder="Assignee name"
                  />
                </div>

                {/* Due Date */}
                <div className="form-group">
                  <label htmlFor="card-due-date">Due Date</label>
                  <input
                    id="card-due-date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => handleInputChange('due_date', e.target.value)}
                  />
                  {isOverdue && (
                    <div className="due-date-warning">
                      ⚠️ This card is overdue
                    </div>
                  )}
                </div>

                {/* Tags */}
                {card.tags.length > 0 && (
                  <div className="form-group">
                    <label>Tags</label>
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
                  </div>
                )}

                {/* Card Meta Info */}
                <div className="card-meta-info">
                  <div className="meta-item">
                    <strong>Created:</strong> {formatDate(card.created_at)}
                  </div>
                  <div className="meta-item">
                    <strong>Updated:</strong> {formatDate(card.updated_at)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="comments-section">
            <h4>Comments ({comments.length})</h4>
            
            {/* Add Comment */}
            <div className="add-comment">
              <div className="comment-author-section">
                <div className="author-input-group">
                  <input
                    type="text"
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    placeholder="Your name (optional)"
                    className="comment-author-input"
                    disabled={autoFillAuthor}
                  />
                  <label className="auto-fill-checkbox">
                    <input
                      type="checkbox"
                      checked={autoFillAuthor}
                      onChange={(e) => handleAutoFillToggle(e.target.checked)}
                    />
                    <span className="checkbox-label">Auto-fill from profile</span>
                  </label>
                </div>
                {autoFillAuthor && !getUserSettings().name && (
                  <div className="auto-fill-warning">
                    <small>💡 Set your name in settings to auto-fill comments</small>
                  </div>
                )}
              </div>
              <div className="comment-input-group">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={3}
                  className="comment-input"
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                >
                  Add Comment
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div className="comments-list">
              {comments.length === 0 ? (
                <div className="no-comments">No comments yet</div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="comment-item">
                    <div className="comment-header">
                      <span className="comment-author">
                        {comment.author || 'Anonymous'}
                      </span>
                      <span className="comment-date">
                        {formatDate(comment.created_at)}
                      </span>
                      <button
                        className="btn-icon comment-delete"
                        onClick={() => onDeleteComment(comment.id)}
                        title="Delete comment"
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="comment-content">
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
          <div className="footer-left">
            <button
              className={`btn ${showDeleteConfirm ? 'btn-danger-confirm' : 'btn-danger'}`}
              onClick={showDeleteConfirm ? handleDelete : () => setShowDeleteConfirm(true)}
            >
              {showDeleteConfirm ? 'Confirm Delete' : 'Delete Card'}
            </button>
            {showDeleteConfirm && (
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            )}
          </div>
          <div className="footer-right">
            <button className="btn btn-secondary" onClick={onClose}>
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
    </div>
  );
};