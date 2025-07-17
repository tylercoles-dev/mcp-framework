import React, { useState } from 'react';
import { KanbanCard } from './KanbanCard';
import { CreateCard } from './CreateCard';
import { Column } from '../types';

interface KanbanColumnProps {
  column: Column;
  onCreateCard: (columnId: number, title: string, description?: string) => void;
  onMoveCard: (cardId: number, columnId: number, position: number) => void;
  onUpdateCard: (cardId: number, updates: any) => void;
  onDeleteCard: (cardId: number) => void;
  loading: boolean;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  onCreateCard,
  onMoveCard,
  onUpdateCard,
  onDeleteCard,
  loading,
}) => {
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const cardData = e.dataTransfer.getData('application/json');
    if (cardData) {
      const { cardId, sourceColumnId } = JSON.parse(cardData);
      if (sourceColumnId !== column.id) {
        // Move to end of this column
        onMoveCard(cardId, column.id, column.cards.length);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleCreateCard = (title: string, description?: string) => {
    onCreateCard(column.id, title, description);
    setShowCreateCard(false);
  };

  return (
    <div 
      className={`kanban-column ${dragOver ? 'drag-over' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="column-header" style={{ backgroundColor: column.color }}>
        <h3>{column.name}</h3>
        <span className="card-count">{column.cards.length}</span>
      </div>

      <div className="column-content">
        {column.cards.map((card, index) => (
          <KanbanCard
            key={card.id}
            card={card}
            columnId={column.id}
            position={index}
            onMoveCard={onMoveCard}
            onUpdateCard={onUpdateCard}
            onDeleteCard={onDeleteCard}
          />
        ))}

        {showCreateCard ? (
          <CreateCard
            onCreateCard={handleCreateCard}
            onCancel={() => setShowCreateCard(false)}
          />
        ) : (
          <button
            className="add-card-btn"
            onClick={() => setShowCreateCard(true)}
            disabled={loading}
          >
            + Add a card
          </button>
        )}
      </div>
    </div>
  );
};