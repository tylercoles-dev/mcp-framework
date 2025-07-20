import React, { useState } from 'react';
import { Column } from '../types';

interface ColumnManagerProps {
  columns: Column[];
  boardId: number;
  onCreateColumn: (boardId: number, name: string, position: number) => void;
  onUpdateColumn: (columnId: number, updates: Partial<Column>) => void;
  onDeleteColumn: (columnId: number) => void;
  onClose: () => void;
}

export function ColumnManager({ 
  columns, 
  boardId, 
  onCreateColumn, 
  onUpdateColumn, 
  onDeleteColumn, 
  onClose 
}: ColumnManagerProps) {
  const [newColumnName, setNewColumnName] = useState('');
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreateColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (newColumnName.trim()) {
      const maxPosition = Math.max(...columns.map(c => c.position), -1);
      onCreateColumn(boardId, newColumnName.trim(), maxPosition + 1);
      setNewColumnName('');
    }
  };

  const startEdit = (column: Column) => {
    setEditingColumn(column.id);
    setEditName(column.name);
  };

  const saveEdit = (columnId: number) => {
    if (editName.trim()) {
      onUpdateColumn(columnId, { name: editName.trim() });
      setEditingColumn(null);
      setEditName('');
    }
  };

  const cancelEdit = () => {
    setEditingColumn(null);
    setEditName('');
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

  return (
    <div className="modal-overlay">
      <div className="modal-content column-manager-modal">
        <div className="modal-header">
          <h2>Manage Columns</h2>
          <button onClick={onClose} className="btn-close">✕</button>
        </div>

        <div className="column-manager-content">
          <form onSubmit={handleCreateColumn} className="add-column-form">
            <h3>Add New Column</h3>
            <div className="form-group">
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Column name"
                required
              />
              <button type="submit" className="btn btn-primary">
                Add Column
              </button>
            </div>
          </form>

          <div className="existing-columns">
            <h3>Existing Columns</h3>
            {sortedColumns.length === 0 ? (
              <p className="no-columns">No columns yet. Add one above to get started.</p>
            ) : (
              <div className="columns-list">
                {sortedColumns.map((column, index) => (
                  <div key={column.id} className="column-item">
                    <div className="column-info">
                      <span className="column-position">#{index + 1}</span>
                      {editingColumn === column.id ? (
                        <div className="edit-column">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(column.id);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            autoFocus
                          />
                          <button onClick={() => saveEdit(column.id)} className="btn btn-sm btn-primary">
                            Save
                          </button>
                          <button onClick={cancelEdit} className="btn btn-sm btn-secondary">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="column-display">
                          <span className="column-name">{column.name}</span>
                          <span className="card-count">
                            {column.cards?.length || 0} cards
                          </span>
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
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete column "${column.name}" and all its cards?`)) {
                                onDeleteColumn(column.id);
                              }
                            }}
                            className="btn btn-sm btn-danger"
                          >
                            Delete
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
          <button onClick={onClose} className="btn btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}