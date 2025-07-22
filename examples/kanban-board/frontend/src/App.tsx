import React, { useState, useEffect } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { BoardSelector } from './components/BoardSelector';
import { CreateBoard } from './components/CreateBoard';
import { BoardManager } from './components/BoardManager';
import { ColumnManager } from './components/ColumnManager';
import { UserSettings } from './components/UserSettings';
import { Button } from './components/ui/Button';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { ToastContainer } from './components/ui/Toast';
import { LoadingSpinner, BoardSkeleton } from './components/ui/LoadingSkeleton';
import { useKanbanStore } from './store/kanban-store';
import { useWebSocket } from './hooks/use-websocket';
import { useToast } from './hooks/useToast';
import { Tag, Comment } from './types';
import { getSelectedBoardId, updateSelectedBoard, getUserSettings } from './utils/localStorage';
import './App.new.css';

function App() {
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [showBoardManager, setShowBoardManager] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);

  // Get state and actions from Zustand store
  const {
    boards,
    selectedBoard,
    boardData,
    loading,
    error: storeError,
    connected,
    setSelectedBoard,
    setError,
  } = useKanbanStore();

  // Local state for comments and tags
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [commentsData, setCommentsData] = useState<Record<number, Comment[]>>({});

  // Initialize WebSocket connection
  const wsClient = useWebSocket('ws://localhost:3002');

  // Toast notifications
  const { toasts, removeToast, success, error: showError, info } = useToast();

  // Load saved board selection on mount
  useEffect(() => {
    const savedBoardId = getSelectedBoardId();
    if (savedBoardId && boards.length > 0) {
      const boardExists = boards.some(board => board.id === savedBoardId);
      if (boardExists) {
        setSelectedBoard(savedBoardId);
      }
    }
  }, [boards, setSelectedBoard]);

  // Save board selection when it changes
  useEffect(() => {
    if (selectedBoard !== null) {
      updateSelectedBoard(selectedBoard);
    }
  }, [selectedBoard]);

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
      success('Board created', `Successfully created "${name}" board`);
    } catch (err) {
      showError('Failed to create board', err instanceof Error ? err.message : 'Unknown error occurred');
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
      showError('Failed to create card', err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  const handleMoveCard = async (cardId: number, columnId: number, position: number) => {
    if (!wsClient) return;
    
    try {
      await wsClient.moveCard(cardId, columnId, position);
    } catch (err) {
      showError('Failed to move card', err instanceof Error ? err.message : 'Unknown error occurred');
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

  const handleCreateColumn = async (boardId: number, name: string, position: number, color?: string) => {
    if (!wsClient) return;
    
    try {
      const result = await wsClient.createColumn({ board_id: boardId, name, position });
      // If a color was specified and we got a column back, update it with the color
      if (color && result?.column?.id) {
        await wsClient.updateColumn(result.column.id, { color });
      }
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
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <div className="header-left">
              <div className="app-title">
                <div className="app-title-icon">K</div>
                Kanban Board
              </div>
            </div>
          </div>
        </header>
        <main className="app-main">
          <BoardSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <div className="app-title">
              <div className="app-title-icon">K</div>
              Kanban Board
            </div>
            <BoardSelector
              boards={boards}
              selectedBoard={selectedBoard}
              onSelectBoard={setSelectedBoard}
            />
          </div>
          <div className="user-menu">
            <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
              <div className="connection-dot" />
              {connected ? 'Connected' : 'Disconnected'}
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowCreateBoard(true)}
              disabled={!connected}
            >
              + New Board
            </Button>
            {selectedBoard && boardData && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setShowBoardManager(true)}
                  disabled={!connected}
                >
                  Manage Board
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowColumnManager(true)}
                  disabled={!connected}
                >
                  Manage Columns
                </Button>
              </>
            )}
            <ThemeToggle />
            <Button
              variant="secondary"
              onClick={() => setShowUserSettings(true)}
            >
              👤 User
            </Button>
          </div>
        </div>
      </header>


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

      {showUserSettings && (
        <UserSettings
          onClose={() => setShowUserSettings(false)}
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

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

export default App;