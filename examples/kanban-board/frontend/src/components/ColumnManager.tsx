import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(5, 1fr)', 
        gap: 'var(--spacing-xs)',
        marginTop: 'var(--spacing-xs)'
      }}>
        {DEFAULT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              border: value === color ? '3px solid var(--color-text-primary)' : '2px solid var(--color-border)',
              backgroundColor: color,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              transform: value === color ? 'scale(1.1)' : 'scale(1)',
              boxShadow: value === color ? 'var(--shadow-md)' : 'var(--shadow-xs)'
            }}
            onClick={() => onChange(color)}
            title={color}
          />
        ))}
      </div>
    </div>
  );

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Manage Columns</h3>
          <button onClick={onClose} className="btn-close">✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Add New Column Form */}
          <div style={{ 
            background: 'var(--color-bg-tertiary)', 
            padding: 'var(--spacing-lg)', 
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            marginBottom: 'var(--spacing-lg)'
          }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
              Add New Column
            </h4>
            <form onSubmit={handleCreateColumn}>
              <div className="form-group">
                <label htmlFor="new-column-name" className="form-label">Column Name *</label>
                <input
                  id="new-column-name"
                  type="text"
                  className="form-input"
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

              <button type="submit" className="btn btn-primary" disabled={!newColumnName.trim()}>
                Add Column
              </button>
            </form>
          </div>

          {/* Existing Columns */}
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
              Existing Columns ({sortedColumns.length})
            </h4>
            {sortedColumns.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: 'var(--spacing-xl)', 
                color: 'var(--color-text-tertiary)',
                fontStyle: 'italic'
              }}>
                No columns yet. Add one above to get started.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {sortedColumns.map((column, index) => (
                  <div key={column.id} style={{
                    background: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--spacing-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-md)'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 'var(--spacing-sm)',
                      minWidth: '60px'
                    }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: column.color,
                        border: '2px solid var(--color-border)'
                      }} />
                      <span style={{ 
                        fontSize: '0.875rem', 
                        fontWeight: '600', 
                        color: 'var(--color-text-secondary)'
                      }}>
                        #{index + 1}
                      </span>
                    </div>

                    <div style={{ flex: '1' }}>
                      {editingColumn === column.id ? (
                        <div>
                          <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                            <input
                              type="text"
                              className="form-input"
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

                          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
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
                        <div>
                          <h5 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 var(--spacing-xs) 0', color: 'var(--color-text-primary)' }}>
                            {column.name}
                          </h5>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '0' }}>
                            {column.cards?.length || 0} card{(column.cards?.length || 0) !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                      {editingColumn !== column.id && (
                        <>
                          <button
                            onClick={() => moveColumn(column.id, 'up')}
                            disabled={index === 0}
                            className="btn-icon"
                            title="Move up"
                            style={{ opacity: index === 0 ? 0.3 : 1 }}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveColumn(column.id, 'down')}
                            disabled={index === sortedColumns.length - 1}
                            className="btn-icon"
                            title="Move down"
                            style={{ opacity: index === sortedColumns.length - 1 ? 0.3 : 1 }}
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => startEdit(column)}
                            className="btn-icon"
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
                            className="btn-icon"
                            title="Delete column"
                            style={{ color: 'var(--color-danger)' }}
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

        <div className="modal-footer">
          <div></div>
          <div>
            <button onClick={onClose} className="btn btn-primary">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}