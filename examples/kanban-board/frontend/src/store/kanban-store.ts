import { create } from 'zustand';
import { Board, KanbanBoardData, Column, Card } from '../types';

interface KanbanState {
  // State
  boards: Board[];
  selectedBoard: number | null;
  boardData: KanbanBoardData | null;
  loading: boolean;
  error: string | null;
  connected: boolean;

  // Actions
  setBoards: (boards: Board[]) => void;
  setSelectedBoard: (boardId: number | null) => void;
  setBoardData: (data: KanbanBoardData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;

  // Board actions
  addBoard: (board: Board) => void;
  updateBoard: (board: Board) => void;
  removeBoard: (boardId: number) => void;

  // Column actions
  addColumn: (column: Column) => void;
  updateColumn: (column: Column) => void;
  removeColumn: (columnId: number) => void;
  updateColumnOrder: (columns: Column[]) => void;

  // Card actions
  addCard: (card: Card) => void;
  updateCard: (card: Card) => void;
  moveCard: (cardId: number, columnId: number, position: number) => void;
  removeCard: (cardId: number) => void;

  // Utility actions
  refreshBoardData: () => void;
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  // Initial state
  boards: [],
  selectedBoard: null,
  boardData: null,
  loading: true,
  error: null,
  connected: false,

  // Basic setters
  setBoards: (boards) => set({ boards }),
  setSelectedBoard: (boardId) => set({ selectedBoard: boardId }),
  setBoardData: (data) => set({ boardData: data }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setConnected: (connected) => set({ connected }),

  // Board actions
  addBoard: (board) => 
    set((state) => ({ 
      boards: [...state.boards, board] 
    })),

  updateBoard: (board) =>
    set((state) => ({
      boards: state.boards.map((b) => (b.id === board.id ? board : b)),
      boardData: state.boardData?.board.id === board.id 
        ? { ...state.boardData, board } 
        : state.boardData,
    })),

  removeBoard: (boardId) =>
    set((state) => ({
      boards: state.boards.filter((b) => b.id !== boardId),
      selectedBoard: state.selectedBoard === boardId ? null : state.selectedBoard,
      boardData: state.boardData?.board.id === boardId ? null : state.boardData,
    })),

  // Column actions
  addColumn: (column) =>
    set((state) => {
      if (!state.boardData || state.boardData.board.id !== column.board_id) {
        return state;
      }
      return {
        boardData: {
          ...state.boardData,
          columns: [...state.boardData.columns, { ...column, cards: [] }],
        },
      };
    }),

  updateColumn: (column) =>
    set((state) => {
      if (!state.boardData) return state;
      return {
        boardData: {
          ...state.boardData,
          columns: state.boardData.columns.map((c) =>
            c.id === column.id ? { ...c, ...column } : c
          ),
        },
      };
    }),

  removeColumn: (columnId) =>
    set((state) => {
      if (!state.boardData) return state;
      return {
        boardData: {
          ...state.boardData,
          columns: state.boardData.columns.filter((c) => c.id !== columnId),
        },
      };
    }),

  updateColumnOrder: (columns) =>
    set((state) => {
      if (!state.boardData) return state;
      return {
        boardData: {
          ...state.boardData,
          columns,
        },
      };
    }),

  // Card actions
  addCard: (card) =>
    set((state) => {
      if (!state.boardData || state.boardData.board.id !== card.board_id) {
        return state;
      }
      const cardWithTags = { ...card, tags: card.tags || [] };
      return {
        boardData: {
          ...state.boardData,
          columns: state.boardData.columns.map((column) =>
            column.id === card.column_id
              ? { ...column, cards: [...column.cards, cardWithTags] }
              : column
          ),
        },
      };
    }),

  updateCard: (card) =>
    set((state) => {
      if (!state.boardData || state.boardData.board.id !== card.board_id) {
        return state;
      }
      const cardWithTags = { ...card, tags: card.tags || [] };
      return {
        boardData: {
          ...state.boardData,
          columns: state.boardData.columns.map((column) => ({
            ...column,
            cards: column.cards.map((c) => (c.id === card.id ? cardWithTags : c)),
          })),
        },
      };
    }),

  moveCard: (cardId, newColumnId, newPosition) =>
    set((state) => {
      if (!state.boardData) return state;

      let movedCard: Card | null = null;
      
      // Remove card from current column
      const columnsWithoutCard = state.boardData.columns.map((column) => ({
        ...column,
        cards: column.cards.filter((card) => {
          if (card.id === cardId) {
            movedCard = card;
            return false;
          }
          return true;
        }),
      }));

      if (!movedCard) return state;

      // Add card to new column at specific position
      const columnsWithCard = columnsWithoutCard.map((column) => {
        if (column.id === newColumnId) {
          const newCards = [...column.cards];
          const cardWithTags = { ...movedCard!, column_id: newColumnId, tags: movedCard!.tags || [] };
          newCards.splice(newPosition, 0, cardWithTags);
          return { ...column, cards: newCards };
        }
        return column;
      });

      return {
        boardData: {
          ...state.boardData,
          columns: columnsWithCard,
        },
      };
    }),

  removeCard: (cardId) =>
    set((state) => {
      if (!state.boardData) return state;
      return {
        boardData: {
          ...state.boardData,
          columns: state.boardData.columns.map((column) => ({
            ...column,
            cards: column.cards.filter((card) => card.id !== cardId),
          })),
        },
      };
    }),

  // Utility action to refresh board data from the current state
  refreshBoardData: () => {
    const state = get();
    if (state.boardData) {
      set({ boardData: { ...state.boardData } });
    }
  },
}));