import React, { useState, useEffect } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { BoardSelector } from './components/BoardSelector';
import { CreateBoard } from './components/CreateBoard';
import { BoardManager } from './components/BoardManager';
import { ColumnManager } from './components/ColumnManager';
import { useKanbanStore } from './store/kanban-store';
import { useWebSocket } from './hooks/use-websocket';
import { Tag, Comment } from './types';
import './App.css';

function App() {
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [showBoardManager, setShowBoardManager] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);

  // Get state and actions from Zustand store
  const {
    boards,
    selectedBoard,
    boardData,
    loading,
    error,
    connected,
    setSelectedBoard,
    setError,
  } = useKanbanStore();

  // Local state for comments and tags
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [commentsData, setCommentsData] = useState<Record<number, Comment[]>>({});

  // Initialize WebSocket connection
  const wsClient = useWebSocket('ws://localhost:3002');

  // Load tags and comments when board changes
  useEffect(() => {
    if (wsClient && selectedBoard && boardData) {
      loadTagsAndComments();
    }
  }, [wsClient, selectedBoard, boardData]);

  const loadTagsAndComments = async () => {
    if (!wsClient || !boardData) return;

    try {
      // Load tags
      const tagsResult = await wsClient.getTags();
      setAvailableTags(tagsResult.tags || []);

      // Load comments for all cards
      const allComments: Record<number, Comment[]> = {};
      for (const column of boardData.columns) {
        for (const card of column.cards) {
          try {
            const commentsResult = await wsClient.getComments(card.id);
            allComments[card.id] = commentsResult.comments || [];
          } catch (err) {
            console.warn(`Failed to load comments for card ${card.id}:`, err);
            allComments[card.id] = [];
          }
        }
      }
      setCommentsData(allComments);
    } catch (err) {
      console.error('Failed to load tags and comments:', err);
    }
  };

  const handleCreateBoard = async (name: string, description: string, color: string) => {
    if (!wsClient) return;
    
    try {
      await wsClient.createBoard({ name, description, color });
      setShowCreateBoard(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create board');
    }
  };

  const handleCreateCard = async (columnId: number, title: string, description?: string) => {
    if (!selectedBoard || !wsClient) return;
    
    try {
      await wsClient.createCard({
        board_id: selectedBoard,
        column_id: columnId,
        title,
        description,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create card');
    }
  };

  const handleMoveCard = async (cardId: number, columnId: number, position: number) => {
    if (!wsClient) return;
    
    try {
      await wsClient.moveCard(cardId, columnId, position);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move card');
    }
  };

  const handleUpdateCard = async (cardId: number, updates: any) => {
    if (!wsClient) return;
    
    try {
      await wsClient.updateCard(cardId, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update card');
    }
  };

  const handleDeleteCard = async (cardId: number) => {
    if (!wsClient) return;
    
    try {
      await wsClient.deleteCard(cardId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete card');
    }
  };

  const handleUpdateBoard = async (boardId: number, updates: any) => {
    if (!wsClient) return;
    
    try {
      await wsClient.updateBoard(boardId, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update board');
    }
  };

  const handleDeleteBoard = async (boardId: number) => {
    if (!wsClient) return;
    
    try {
      await wsClient.deleteBoard(boardId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete board');
    }
  };

  const handleCreateColumn = async (boardId: number, name: string, position: number) => {
    if (!wsClient) return;
    
    try {
      await wsClient.createColumn({ board_id: boardId, name, position });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create column');
    }
  };

  const handleUpdateColumn = async (columnId: number, updates: any) => {
    if (!wsClient) return;
    
    try {
      await wsClient.updateColumn(columnId, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update column');
    }
  };

  const handleDeleteColumn = async (columnId: number) => {
    if (!wsClient) return;
    
    try {
      await wsClient.deleteColumn(columnId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete column');
    }
  };

  const handleAddComment = async (cardId: number, content: string, author?: string) => {
    if (!wsClient) return;
    
    try {
      await wsClient.addComment({ card_id: cardId, content, author });
      // Reload comments for this card
      const commentsResult = await wsClient.getComments(cardId);
      setCommentsData(prev => ({
        ...prev,
        [cardId]: commentsResult.comments || []
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!wsClient) return;
    
    try {
      await wsClient.deleteComment(commentId);
      // Find the card that contained this comment and reload its comments
      for (const [cardIdStr, comments] of Object.entries(commentsData)) {
        const cardId = parseInt(cardIdStr);
        if (comments.some(comment => comment.id === commentId)) {
          const commentsResult = await wsClient.getComments(cardId);
          setCommentsData(prev => ({
            ...prev,
            [cardId]: commentsResult.comments || []
          }));
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
    }
  };

  if (loading && !boardData) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading kanban board...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🗂️ Kanban Board <span style={{fontSize: '0.6em', color: connected ? '#4CAF50' : '#f44336'}}>({connected ? 'Real-time' : 'Disconnected'})</span></h1>
        <div className="header-controls">
          <BoardSelector
            boards={boards}
            selectedBoard={selectedBoard}
            onSelectBoard={setSelectedBoard}
          />
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateBoard(true)}
            disabled={!connected}
          >
            + New Board
          </button>
          {selectedBoard && boardData && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setShowBoardManager(true)}
                disabled={!connected}
              >
                Manage Board
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowColumnManager(true)}
                disabled={!connected}
              >
                Manage Columns
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <p>⚠️ {error}</p>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {showCreateBoard && (
        <CreateBoard
          onCreateBoard={handleCreateBoard}
          onCancel={() => setShowCreateBoard(false)}
        />
      )}

      {showBoardManager && selectedBoard && boardData && (
        <BoardManager
          board={boardData.board}
          onUpdateBoard={handleUpdateBoard}
          onDeleteBoard={handleDeleteBoard}
          onClose={() => setShowBoardManager(false)}
        />
      )}

      {showColumnManager && selectedBoard && boardData && (
        <ColumnManager
          columns={boardData.columns}
          boardId={selectedBoard}
          onCreateColumn={handleCreateColumn}
          onUpdateColumn={handleUpdateColumn}
          onDeleteColumn={handleDeleteColumn}
          onClose={() => setShowColumnManager(false)}
        />
      )}

      <main className="app-main">
        {boardData ? (
          <KanbanBoard
            boardData={boardData}
            availableTags={availableTags}
            commentsData={commentsData}
            onCreateCard={handleCreateCard}
            onMoveCard={handleMoveCard}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            loading={loading}
          />
        ) : (
          <div className="empty-state">
            <h2>No board selected</h2>
            <p>Select a board from the dropdown or create a new one to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;