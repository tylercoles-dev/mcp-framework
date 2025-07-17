import React, { useState, useEffect } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { BoardSelector } from './components/BoardSelector';
import { CreateBoard } from './components/CreateBoard';
import { MCPClient } from './services/mcp-client';
import { Board, KanbanBoardData } from './types';
import './App.css';

const mcpClient = new MCPClient('http://localhost:3001');

function App() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<number | null>(null);
  const [boardData, setBoardData] = useState<KanbanBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateBoard, setShowCreateBoard] = useState(false);

  useEffect(() => {
    loadBoards();
  }, []);

  useEffect(() => {
    if (selectedBoard) {
      loadBoardData(selectedBoard);
    }
  }, [selectedBoard]);

  const loadBoards = async () => {
    try {
      setLoading(true);
      const result = await mcpClient.callTool('get_boards', {});
      if (result.structuredContent) {
        setBoards(result.structuredContent as Board[]);
        if (!selectedBoard && result.structuredContent.length > 0) {
          setSelectedBoard(result.structuredContent[0].id);
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load boards');
    } finally {
      setLoading(false);
    }
  };

  const loadBoardData = async (boardId: number) => {
    try {
      setLoading(true);
      const result = await mcpClient.callTool('get_board', { board_id: boardId });
      if (result.structuredContent) {
        setBoardData(result.structuredContent as KanbanBoardData);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBoard = async (name: string, description: string, color: string) => {
    try {
      await mcpClient.callTool('create_board', { name, description, color });
      await loadBoards();
      setShowCreateBoard(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create board');
    }
  };

  const handleCreateCard = async (columnId: number, title: string, description?: string) => {
    if (!selectedBoard) return;
    
    try {
      await mcpClient.callTool('create_card', {
        board_id: selectedBoard,
        column_id: columnId,
        title,
        description,
      });
      await loadBoardData(selectedBoard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create card');
    }
  };

  const handleMoveCard = async (cardId: number, columnId: number, position: number) => {
    try {
      await mcpClient.callTool('move_card', {
        card_id: cardId,
        column_id: columnId,
        position,
      });
      if (selectedBoard) {
        await loadBoardData(selectedBoard);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move card');
    }
  };

  const handleUpdateCard = async (cardId: number, updates: any) => {
    try {
      await mcpClient.callTool('update_card', {
        card_id: cardId,
        ...updates,
      });
      if (selectedBoard) {
        await loadBoardData(selectedBoard);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update card');
    }
  };

  const handleDeleteCard = async (cardId: number) => {
    try {
      await mcpClient.callTool('delete_card', { card_id: cardId });
      if (selectedBoard) {
        await loadBoardData(selectedBoard);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete card');
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
        <h1>🗂️ Kanban Board</h1>
        <div className="header-controls">
          <BoardSelector
            boards={boards}
            selectedBoard={selectedBoard}
            onSelectBoard={setSelectedBoard}
          />
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateBoard(true)}
          >
            + New Board
          </button>
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

      <main className="app-main">
        {boardData ? (
          <KanbanBoard
            boardData={boardData}
            onCreateCard={handleCreateCard}
            onMoveCard={handleMoveCard}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
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