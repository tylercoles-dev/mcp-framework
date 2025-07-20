import { useEffect, useRef } from 'react';
import { WebSocketKanbanClient } from '../services/websocket-client';
import { useKanbanStore } from '../store/kanban-store';
import { Board, KanbanBoardData, Column, Card } from '../types';

export function useWebSocket(wsUrl: string) {
  const wsClient = useRef<WebSocketKanbanClient | null>(null);
  const {
    setConnected,
    setError,
    setBoards,
    setBoardData,
    setLoading,
    selectedBoard,
    addBoard,
    updateBoard,
    removeBoard,
    addCard,
    updateCard,
    moveCard,
    removeCard,
    refreshBoardData,
  } = useKanbanStore();

  useEffect(() => {
    // Create WebSocket client if not exists
    if (!wsClient.current) {
      wsClient.current = new WebSocketKanbanClient(wsUrl);
    }

    const client = wsClient.current;

    const connectWebSocket = async () => {
      try {
        await client.connect();
        setConnected(true);
        setError(null);

        // Set up event listeners for real-time updates
        client.on('board_created', (board: Board) => {
          console.log('Board created event:', board);
          addBoard(board);
        });

        client.on('board_updated', (board: Board) => {
          console.log('Board updated event:', board);
          updateBoard(board);
        });

        client.on('board_deleted', (data: { board_id: number }) => {
          console.log('Board deleted event:', data);
          removeBoard(data.board_id);
        });

        client.on('card_created', (card: Card) => {
          console.log('Card created event:', card);
          addCard({ ...card, tags: card.tags || [] });
        });

        client.on('card_updated', (card: Card) => {
          console.log('Card updated event:', card);
          updateCard({ ...card, tags: card.tags || [] });
        });

        client.on('card_moved', (card: Card) => {
          console.log('Card moved event:', card);
          // For move operations, we need to handle the position update
          if (card.column_id !== undefined && card.position !== undefined) {
            moveCard(card.id, card.column_id, card.position);
          }
        });

        client.on('card_deleted', (data: { card_id: number }) => {
          console.log('Card deleted event:', data);
          removeCard(data.card_id);
        });

        client.on('column_created', (column: Column) => {
          console.log('Column created event:', column);
          // Reload board data to get proper column ordering
          if (selectedBoard === column.board_id) {
            loadBoardData(selectedBoard);
          }
        });

        client.on('column_updated', (column: Column) => {
          console.log('Column updated event:', column);
          // Reload board data to get proper column ordering
          if (selectedBoard && column.board_id) {
            loadBoardData(selectedBoard);
          }
        });

        client.on('column_deleted', (data: { column_id: number }) => {
          console.log('Column deleted event:', data);
          // Reload board data to properly handle column deletion
          if (selectedBoard) {
            loadBoardData(selectedBoard);
          }
        });

        client.on('disconnect', () => {
          setConnected(false);
          setError('Connection lost. Attempting to reconnect...');
        });

        // Load initial boards
        await loadBoards();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to server');
        setConnected(false);
      }
    };

    const loadBoards = async () => {
      try {
        setLoading(true);
        const result = await client.getBoards();
        if (result?.boards) {
          setBoards(result.boards as Board[]);
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
        const result = await client.getBoard(boardId);
        if (result) {
          setBoardData(result as KanbanBoardData);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load board data');
      } finally {
        setLoading(false);
      }
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      if (client) {
        client.off('board_created', () => {});
        client.off('board_updated', () => {});
        client.off('board_deleted', () => {});
        client.off('card_created', () => {});
        client.off('card_updated', () => {});
        client.off('card_moved', () => {});
        client.off('card_deleted', () => {});
        client.off('column_created', () => {});
        client.off('column_updated', () => {});
        client.off('column_deleted', () => {});
        client.off('disconnect', () => {});
        client.disconnect();
      }
    };
  }, []);

  // Load board data when selected board changes
  useEffect(() => {
    if (selectedBoard && wsClient.current) {
      const loadBoardData = async () => {
        try {
          setLoading(true);
          const result = await wsClient.current!.getBoard(selectedBoard);
          if (result) {
            setBoardData(result as KanbanBoardData);
          }
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load board data');
        } finally {
          setLoading(false);
        }
      };
      loadBoardData();
    }
  }, [selectedBoard, setBoardData, setError, setLoading]);

  return wsClient.current;
}