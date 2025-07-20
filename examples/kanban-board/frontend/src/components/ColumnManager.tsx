import React, { useState } from 'react';
import { Column } from '../types';

interface ColumnManagerProps {
  columns: Column[];
  boardId: number;
  onCreateColumn: (boardId: number, name: string, position: number, color?: string) => void;
  onUpdateColumn: (columnId: number, updates: Partial<Column>) => void;
  onDeleteColumn: (columnId: number) => void;
  onClose: () => void;
}

const DEFAULT_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6b7280', // Gray
];

export function ColumnManager({ 
  columns, 
  boardId, 
  onCreateColumn, 
  onUpdateColumn, 
  onDeleteColumn, 
  onClose 
}: ColumnManagerProps) {
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnColor, setNewColumnColor] = useState(DEFAULT_COLORS[0]);
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', color: '' });

  const handleCreateColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (newColumnName.trim()) {
      const maxPosition = Math.max(...columns.map(c => c.position), -1);
      // We'll need to update the onCreateColumn to handle color
      const columnData = {
        board_id: boardId,
        name: newColumnName.trim(),
        position: maxPosition + 1,
        color: newColumnColor
      };
      onCreateColumn(boardId, newColumnName.trim(), maxPosition + 1, newColumnColor);
      setNewColumnName('');
      // Cycle to next color for convenience
      const currentIndex = DEFAULT_COLORS.indexOf(newColumnColor);
      const nextIndex = (currentIndex + 1) % DEFAULT_COLORS.length;
      setNewColumnColor(DEFAULT_COLORS[nextIndex]);
    }
  };

  const startEdit = (column: Column) => {
    setEditingColumn(column.id);
    setEditFormData({ name: column.name, color: column.color });
  };

  const saveEdit = (columnId: number) => {
    if (editFormData.name.trim()) {
      onUpdateColumn(columnId, { 
        name: editFormData.name.trim(),
        color: editFormData.color 
      });
      setEditingColumn(null);
      setEditFormData({ name: '', color: '' });
    }
  };

  const cancelEdit = () => {
    setEditingColumn(null);
    setEditFormData({ name: '', color: '' });
  };

  const moveColumn = (columnId: number, direction: 'up' | 'down') => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return;

    const sortedColumns = [...columns].sort((a, b) => a.position - b.position);
    const currentIndex = sortedColumns.findIndex(c => c.id === columnId);
    
    if (direction === 'up' && currentIndex > 0) {
      const targetColumn = sortedColumns[currentIndex - 1];
      onUpdateColumn(columnId, { position: targetColumn.position });
      onUpdateColumn(targetColumn.id, { position: column.position });
    } else if (direction === 'down' && currentIndex < sortedColumns.length - 1) {
      const targetColumn = sortedColumns[currentIndex + 1];
      onUpdateColumn(columnId, { position: targetColumn.position });
      onUpdateColumn(targetColumn.id, { position: column.position });
    }
  };

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  const ColorPicker = ({ value, onChange, label }: { 
    value: string; 
    onChange: (color: string) => void; 
    label?: string;
  }) => (
    <div className="color-picker-section">
      {label && <label className="color-picker-label">{label}</label>}
      <div className="color-picker-grid">
        {DEFAULT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`color-option ${value === color ? 'selected' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            title={color}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal column-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Manage Columns</h3>
          <button onClick={onClose} className="btn-close">✕</button>
        </div>

        <div className="modal-content">
          <div className="column-manager-content">
            {/* Add New Column Form */}
            <form onSubmit={handleCreateColumn} className="add-column-form">
              <h4>Add New Column</h4>
              <div className="form-group">
                <label htmlFor="new-column-name">Column Name</label>
                <input
                  id="new-column-name"
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Enter column name"
                  required
                />
              </div>
              
              <ColorPicker 
                value={newColumnColor}
                onChange={setNewColumnColor}
                label="Column Color"
              />

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={!newColumnName.trim()}>
                  Add Column
                </button>
              </div>
            </form>

            {/* Existing Columns */}
            <div className="existing-columns">
              <h4>Existing Columns ({sortedColumns.length})</h4>
              {sortedColumns.length === 0 ? (
                <div className="no-columns">
                  <p>No columns yet. Add one above to get started.</p>
                </div>
              ) : (
                <div className="columns-list">
                  {sortedColumns.map((column, index) => (
                    <div key={column.id} className="column-item">
                      <div className="column-preview">
                        <div 
                          className="column-color-indicator"
                          style={{ backgroundColor: column.color }}
                        />
                        <div className="column-position">#{index + 1}</div>
                      </div>

                      <div className="column-details">
                        {editingColumn === column.id ? (
                          <div className="edit-column-form">
                            <div className="form-group">
                              <input
                                type="text"
                                value={editFormData.name}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit(column.id);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                placeholder="Column name"
                                autoFocus
                              />
                            </div>
                            
                            <ColorPicker 
                              value={editFormData.color}
                              onChange={(color) => setEditFormData(prev => ({ ...prev, color }))}
                            />

                            <div className="edit-actions">
                              <button 
                                onClick={() => saveEdit(column.id)} 
                                className="btn btn-sm btn-primary"
                                disabled={!editFormData.name.trim()}
                              >
                                Save
                              </button>
                              <button onClick={cancelEdit} className="btn btn-sm btn-secondary">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="column-display">
                            <div className="column-info">
                              <h5 className="column-name">{column.name}</h5>
                              <p className="card-count">
                                {column.cards?.length || 0} card{(column.cards?.length || 0) !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="column-actions">
                        {editingColumn !== column.id && (
                          <>
                            <button
                              onClick={() => moveColumn(column.id, 'up')}
                              disabled={index === 0}
                              className="btn btn-sm btn-icon"
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveColumn(column.id, 'down')}
                              disabled={index === sortedColumns.length - 1}
                              className="btn btn-sm btn-icon"
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => startEdit(column)}
                              className="btn btn-sm btn-secondary"
                              title="Edit column"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete column "${column.name}" and all its cards?`)) {
                                  onDeleteColumn(column.id);
                                }
                              }}
                              className="btn btn-sm btn-danger"
                              title="Delete column"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-right">
            <button onClick={onClose} className="btn btn-primary">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}