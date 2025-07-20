export interface WebSocketMessage {
  type: string;
  payload?: any;
  id?: string;
}

export interface KanbanWebSocketClient {
  connect(): Promise<void>;
  disconnect(): void;
  on(event: string, callback: (data: any) => void): void;
  off(event: string, callback: (data: any) => void): void;
  
  // Board operations
  getBoards(): Promise<any>;
  getBoard(boardId: number): Promise<any>;
  createBoard(data: { name: string; description?: string; color?: string }): Promise<any>;
  updateBoard(boardId: number, data: any): Promise<any>;
  deleteBoard(boardId: number): Promise<any>;
  
  // Column operations
  createColumn(data: { board_id: number; name: string; position: number }): Promise<any>;
  updateColumn(columnId: number, data: any): Promise<any>;
  deleteColumn(columnId: number): Promise<any>;
  
  // Card operations
  createCard(data: any): Promise<any>;
  updateCard(cardId: number, data: any): Promise<any>;
  moveCard(cardId: number, columnId: number, position: number): Promise<any>;
  deleteCard(cardId: number): Promise<any>;
  
  // Tag operations
  getTags(): Promise<any>;
  createTag(data: any): Promise<any>;
  addCardTag(cardId: number, tagId: number): Promise<any>;
  removeCardTag(cardId: number, tagId: number): Promise<any>;
  
  // Comment operations
  addComment(data: any): Promise<any>;
  getComments(cardId: number): Promise<any>;
  deleteComment(commentId: number): Promise<any>;
  
  // Analytics
  getStats(): Promise<any>;
  searchCards(query: string, filters?: any): Promise<any>;
}

export class WebSocketKanbanClient implements KanbanWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private eventHandlers: Map<string, Set<(data: any) => void>> = new Map();
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string) {
    this.url = url.replace(/^http/, 'ws');
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.connected = false;
          this.attemptReconnect();
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (!this.connected) {
            reject(new Error('Failed to connect to WebSocket'));
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(callback);
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    if (message.id && this.pendingRequests.has(message.id)) {
      // Handle response to a request
      const { resolve, reject } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);
      
      if (message.type === 'error') {
        reject(new Error(message.payload?.message || 'Request failed'));
      } else {
        resolve(message.payload);
      }
    } else {
      // Handle real-time updates
      this.emit(message.type, message.payload);
    }
  }

  private async sendRequest(type: string, payload?: any): Promise<any> {
    if (!this.connected || !this.ws) {
      throw new Error('WebSocket not connected');
    }

    const id = Math.random().toString(36).substring(2, 15);
    const message: WebSocketMessage = { type, payload, id };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(message));
      
      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('disconnect', { reason: 'max_attempts_reached' });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  // Board operations
  async getBoards(): Promise<any> {
    return this.sendRequest('get_boards');
  }

  async getBoard(boardId: number): Promise<any> {
    return this.sendRequest('get_board', { board_id: boardId });
  }

  async createBoard(data: { name: string; description?: string; color?: string }): Promise<any> {
    return this.sendRequest('create_board', data);
  }

  async updateBoard(boardId: number, data: any): Promise<any> {
    return this.sendRequest('update_board', { board_id: boardId, ...data });
  }

  async deleteBoard(boardId: number): Promise<any> {
    return this.sendRequest('delete_board', { board_id: boardId });
  }

  // Column operations
  async createColumn(data: { board_id: number; name: string; position: number }): Promise<any> {
    return this.sendRequest('create_column', data);
  }

  async updateColumn(columnId: number, data: any): Promise<any> {
    return this.sendRequest('update_column', { column_id: columnId, ...data });
  }

  async deleteColumn(columnId: number): Promise<any> {
    return this.sendRequest('delete_column', { column_id: columnId });
  }

  // Card operations
  async createCard(data: any): Promise<any> {
    return this.sendRequest('create_card', data);
  }

  async updateCard(cardId: number, data: any): Promise<any> {
    return this.sendRequest('update_card', { card_id: cardId, ...data });
  }

  async moveCard(cardId: number, columnId: number, position: number): Promise<any> {
    return this.sendRequest('move_card', { card_id: cardId, column_id: columnId, position });
  }

  async deleteCard(cardId: number): Promise<any> {
    return this.sendRequest('delete_card', { card_id: cardId });
  }

  // Tag operations
  async getTags(): Promise<any> {
    return this.sendRequest('get_tags');
  }

  async createTag(data: any): Promise<any> {
    return this.sendRequest('create_tag', data);
  }

  async addCardTag(cardId: number, tagId: number): Promise<any> {
    return this.sendRequest('add_card_tag', { card_id: cardId, tag_id: tagId });
  }

  async removeCardTag(cardId: number, tagId: number): Promise<any> {
    return this.sendRequest('remove_card_tag', { card_id: cardId, tag_id: tagId });
  }

  // Comment operations
  async addComment(data: any): Promise<any> {
    return this.sendRequest('add_comment', data);
  }

  async getComments(cardId: number): Promise<any> {
    return this.sendRequest('get_comments', { card_id: cardId });
  }

  async deleteComment(commentId: number): Promise<any> {
    return this.sendRequest('delete_comment', { comment_id: commentId });
  }

  // Analytics
  async getStats(): Promise<any> {
    return this.sendRequest('get_stats');
  }

  async searchCards(query: string, filters?: any): Promise<any> {
    return this.sendRequest('search_cards', { query, ...filters });
  }
}