import { 
  CallToolResult, 
  GetPromptResult,
  ReadResourceResult,
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Simplified tool interface
 */
export interface ToolInfo {
  name: string;
  title?: string;
  description: string;
  inputSchema: any;
}

/**
 * Simplified resource interface
 */
export interface ResourceInfo {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

/**
 * Simplified prompt interface
 */
export interface PromptInfo {
  name: string;
  title?: string;
  description?: string;
  arguments?: any[];
}

/**
 * Base interface that all MCP clients must implement
 */
export interface IMCPClient {
  /**
   * Connect to the MCP server
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the MCP server
   */
  disconnect(): Promise<void>;

  /**
   * Check if client is connected
   */
  isConnected(): boolean;

  /**
   * List all available tools
   */
  listTools(): Promise<ToolInfo[]>;

  /**
   * Call a tool with arguments
   */
  callTool(name: string, args?: any): Promise<CallToolResult>;

  /**
   * List all available resources
   */
  listResources(): Promise<ResourceInfo[]>;

  /**
   * Read a resource by URI
   */
  readResource(uri: string): Promise<ReadResourceResult>;

  /**
   * List all available prompts
   */
  listPrompts(): Promise<PromptInfo[]>;

  /**
   * Get a prompt with arguments
   */
  getPrompt(name: string, args?: any): Promise<GetPromptResult>;

  /**
   * Get the underlying SDK client (for advanced usage)
   */
  getSDKClient(): any; // Using any to avoid SDK dependency in interface
}

/**
 * Enhanced MCP client interface with advanced features
 */
export interface IEnhancedMCPClient extends IMCPClient {
  /**
   * Call a tool with advanced options
   */
  callTool(name: string, args?: any, options?: CallOptions): Promise<CallToolResult>;
  
  /**
   * Cancel a request by ID
   */
  cancelRequest(requestId: string): Promise<void>;
  
  /**
   * Subscribe to progress notifications
   */
  subscribeToProgress(callback: ProgressCallback): () => void;
  
  /**
   * Subscribe to connection state changes
   */
  subscribeToConnectionState(callback: ConnectionStateCallback): () => void;
  
  /**
   * Subscribe to all messages
   */
  subscribeToMessages(callback: MessageCallback): () => void;
  
  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState;
  
  /**
   * Get session context
   */
  getSessionContext(): SessionContext | null;
  
  /**
   * Set session context
   */
  setSessionContext(context: Partial<SessionContext>): void;
  
  /**
   * Clear session context
   */
  clearSessionContext(): void;
  
  /**
   * Send a custom JSON-RPC message
   */
  sendMessage(message: JSONRPCMessage): Promise<JSONRPCResponse | void>;
  
  /**
   * Get client statistics
   */
  getStats(): {
    connectTime?: Date;
    lastActivity?: Date;
    requestCount: number;
    errorCount: number;
    reconnectCount: number;
  };
}

/**
 * Multi-server MCP client interface
 */
export interface IMultiServerMCPClient {
  /**
   * Add a server configuration
   */
  addServer(serverConfig: ServerConfig): Promise<void>;
  
  /**
   * Remove a server
   */
  removeServer(serverName: string): Promise<void>;
  
  /**
   * List all configured servers
   */
  listServers(): ServerConfig[];
  
  /**
   * Get tools from all servers
   */
  getAllTools(): Promise<Array<ToolInfo & { serverName: string }>>;
  
  /**
   * Call a tool on a specific server
   */
  callToolOnServer(serverName: string, toolName: string, args?: any, options?: CallOptions): Promise<CallToolResult>;
  
  /**
   * Get the best server for a tool (based on capabilities and priority)
   */
  getBestServerForTool(toolName: string): Promise<string | null>;
}

/**
 * Abstract base class that provides common MCP client functionality
 */
export abstract class BaseMCPClient implements IEnhancedMCPClient {
  protected connectionState = ConnectionState.Disconnected;
  protected config: Required<ClientConfig>;
  protected sessionContext: SessionContext | null = null;
  protected progressCallbacks: Set<ProgressCallback> = new Set();
  protected connectionStateCallbacks: Set<ConnectionStateCallback> = new Set();
  protected messageCallbacks: Set<MessageCallback> = new Set();
  protected activeRequests: Map<string, CancellationToken> = new Map();
  protected stats = {
    connectTime: undefined as Date | undefined,
    lastActivity: undefined as Date | undefined,
    requestCount: 0,
    errorCount: 0,
    reconnectCount: 0
  };
  protected heartbeatTimer?: NodeJS.Timeout;
  protected reconnectTimer?: NodeJS.Timeout;

  constructor(config: ClientConfig = {}) {
    this.config = {
      timeout: 30000,
      retries: 3,
      debug: false,
      autoReconnect: true,
      maxRetries: 5,
      retryDelay: 1000,
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      sessionPersistence: false,
      sessionTimeout: 3600000, // 1 hour
      ...config
    };
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract listTools(): Promise<ToolInfo[]>;
  abstract listResources(): Promise<ResourceInfo[]>;
  abstract readResource(uri: string): Promise<ReadResourceResult>;
  abstract listPrompts(): Promise<PromptInfo[]>;
  abstract getPrompt(name: string, args?: any): Promise<GetPromptResult>;
  abstract getSDKClient(): any;
  abstract sendMessage(message: JSONRPCMessage): Promise<JSONRPCResponse | void>;

  /**
   * Enhanced tool calling with options
   */
  async callTool(name: string, args?: any, options?: CallOptions): Promise<CallToolResult> {
    this.ensureConnected();
    this.updateActivity();
    this.stats.requestCount++;

    try {
      const requestId = this.generateRequestId();
      
      // Create cancellation token if needed
      if (options?.cancellationToken) {
        this.activeRequests.set(requestId, options.cancellationToken);
      }

      // Set up progress handling
      if (options?.onProgress) {
        const unsubscribe = this.subscribeToProgress(options.onProgress);
        // Clean up after request completes
        options.cancellationToken?.onCancelled(() => unsubscribe());
      }

      const result = await this.doCallTool(name, args, options, requestId);
      
      // Clean up
      this.activeRequests.delete(requestId);
      
      return result;
    } catch (error) {
      this.stats.errorCount++;
      throw error;
    }
  }

  protected abstract doCallTool(name: string, args?: any, options?: CallOptions, requestId?: string): Promise<CallToolResult>;

  /**
   * Cancel a request by ID
   */
  async cancelRequest(requestId: string): Promise<void> {
    const cancellationToken = this.activeRequests.get(requestId);
    if (cancellationToken) {
      cancellationToken.cancel();
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Subscribe to progress notifications
   */
  subscribeToProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  /**
   * Subscribe to connection state changes
   */
  subscribeToConnectionState(callback: ConnectionStateCallback): () => void {
    this.connectionStateCallbacks.add(callback);
    return () => this.connectionStateCallbacks.delete(callback);
  }

  /**
   * Subscribe to all messages
   */
  subscribeToMessages(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.Connected;
  }

  /**
   * Get session context
   */
  getSessionContext(): SessionContext | null {
    return this.sessionContext;
  }

  /**
   * Set session context
   */
  setSessionContext(context: Partial<SessionContext>): void {
    if (this.sessionContext) {
      this.sessionContext = { ...this.sessionContext, ...context };
    } else {
      this.sessionContext = {
        sessionId: this.generateSessionId(),
        startTime: new Date(),
        lastActivity: new Date(),
        ...context
      };
    }
  }

  /**
   * Clear session context
   */
  clearSessionContext(): void {
    this.sessionContext = null;
  }

  /**
   * Get client statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Set connection state and notify callbacks
   */
  protected setConnectionState(state: ConnectionState, error?: Error): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      
      if (state === ConnectionState.Connected) {
        this.stats.connectTime = new Date();
        this.startHeartbeat();
      } else {
        this.stopHeartbeat();
      }
      
      // Notify callbacks
      for (const callback of this.connectionStateCallbacks) {
        try {
          callback(state, error);
        } catch (err) {
          console.error('Connection state callback error:', err);
        }
      }
      
      // Handle auto-reconnection
      if (state === ConnectionState.Error || state === ConnectionState.Disconnected) {
        if (this.config.autoReconnect && this.stats.reconnectCount < this.config.maxRetries) {
          this.scheduleReconnect();
        }
      }
    }
  }

  /**
   * Notify progress callbacks
   */
  protected notifyProgress(progress: {
    progressToken: string | number;
    progress: number;
    total?: number;
    message?: string;
  }): void {
    for (const callback of this.progressCallbacks) {
      try {
        callback(progress);
      } catch (err) {
        console.error('Progress callback error:', err);
      }
    }
  }

  /**
   * Notify message callbacks
   */
  protected notifyMessage(message: JSONRPCMessage): void {
    for (const callback of this.messageCallbacks) {
      try {
        callback(message);
      } catch (err) {
        console.error('Message callback error:', err);
      }
    }
  }

  /**
   * Ensure the client is connected before operations
   */
  protected ensureConnected(): void {
    if (!this.isConnected()) {
      throw new Error("Client is not connected. Call connect() first.");
    }
  }

  /**
   * Update last activity time
   */
  protected updateActivity(): void {
    this.stats.lastActivity = new Date();
    if (this.sessionContext) {
      this.sessionContext.lastActivity = new Date();
    }
  }

  /**
   * Generate unique request ID
   */
  protected generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique session ID
   */
  protected generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start heartbeat mechanism
   */
  protected startHeartbeat(): void {
    if (this.config.heartbeatInterval > 0) {
      this.heartbeatTimer = setInterval(() => {
        this.sendHeartbeat().catch(err => {
          console.error('Heartbeat failed:', err);
          this.setConnectionState(ConnectionState.Error, err);
        });
      }, this.config.heartbeatInterval);
    }
  }

  /**
   * Stop heartbeat mechanism
   */
  protected stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Send heartbeat ping
   */
  protected abstract sendHeartbeat(): Promise<void>;

  /**
   * Schedule reconnection attempt
   */
  protected scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    const delay = this.config.retryDelay * Math.pow(2, this.stats.reconnectCount);
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        this.stats.reconnectCount++;
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
        if (this.stats.reconnectCount < this.config.maxRetries) {
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  /**
   * Clean up resources
   */
  protected cleanup(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.activeRequests.clear();
    this.progressCallbacks.clear();
    this.connectionStateCallbacks.clear();
    this.messageCallbacks.clear();
  }
}

/**
 * Connection state for MCP clients
 */
export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Disconnecting = 'disconnecting',
  Error = 'error'
}

/**
 * Progress callback for long-running operations
 */
export interface ProgressCallback {
  (progress: {
    progressToken: string | number;
    progress: number;
    total?: number;
    message?: string;
  }): void;
}

/**
 * Connection state change callback
 */
export interface ConnectionStateCallback {
  (state: ConnectionState, error?: Error): void;
}

/**
 * Message handler callback
 */
export interface MessageCallback {
  (message: JSONRPCMessage): void;
}

/**
 * Cancellation token for request cancellation
 */
export interface CancellationToken {
  isCancelled: boolean;
  onCancelled: (callback: () => void) => void;
  cancel: () => void;
}

/**
 * Options for calling tools, prompts, and resources
 */
export interface CallOptions {
  timeout?: number;
  cancellationToken?: CancellationToken;
  onProgress?: ProgressCallback;
  metadata?: Record<string, any>;
}

/**
 * Server configuration for multi-server support
 */
export interface ServerConfig {
  name: string;
  transport: 'stdio' | 'http' | 'websocket';
  config: any; // Transport-specific configuration
  capabilities?: string[];
  priority?: number;
}

/**
 * Session context for maintaining state across requests
 */
export interface SessionContext {
  sessionId: string;
  user?: any;
  metadata?: Record<string, any>;
  startTime: Date;
  lastActivity: Date;
}

/**
 * Configuration interface for enhanced MCP clients
 */
export interface ClientConfig {
  // Connection settings
  timeout?: number;
  retries?: number;
  debug?: boolean;
  
  // Auto-reconnection settings
  autoReconnect?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  
  // Heartbeat settings
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  
  // Progress tracking
  onProgress?: ProgressCallback;
  onConnectionStateChange?: ConnectionStateCallback;
  onMessage?: MessageCallback;
  
  // Session management
  sessionPersistence?: boolean;
  sessionTimeout?: number;
}

/**
 * Utility function to create a cancellation token
 */
export function createCancellationToken(): CancellationToken {
  let cancelled = false;
  const callbacks: (() => void)[] = [];
  
  return {
    get isCancelled() {
      return cancelled;
    },
    onCancelled(callback: () => void) {
      if (cancelled) {
        callback();
      } else {
        callbacks.push(callback);
      }
    },
    cancel() {
      if (!cancelled) {
        cancelled = true;
        callbacks.forEach(cb => {
          try {
            cb();
          } catch (error) {
            console.error('Cancellation callback error:', error);
          }
        });
        callbacks.length = 0;
      }
    }
  };
}

/**
 * Multi-server MCP client implementation
 */
export class MultiServerMCPClient implements IMultiServerMCPClient {
  private servers: Map<string, { config: ServerConfig; client: IEnhancedMCPClient }> = new Map();
  private clientFactory: MCPClientFactory;

  constructor(clientFactory: MCPClientFactory) {
    this.clientFactory = clientFactory;
  }

  /**
   * Add a server configuration
   */
  async addServer(serverConfig: ServerConfig): Promise<void> {
    if (this.servers.has(serverConfig.name)) {
      throw new Error(`Server '${serverConfig.name}' already exists`);
    }

    const client = this.clientFactory.create(serverConfig.config) as IEnhancedMCPClient;
    await client.connect();
    
    this.servers.set(serverConfig.name, { config: serverConfig, client });
  }

  /**
   * Remove a server
   */
  async removeServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (server) {
      await server.client.disconnect();
      this.servers.delete(serverName);
    }
  }

  /**
   * List all configured servers
   */
  listServers(): ServerConfig[] {
    return Array.from(this.servers.values()).map(s => s.config);
  }

  /**
   * Get tools from all servers
   */
  async getAllTools(): Promise<Array<ToolInfo & { serverName: string }>> {
    const allTools: Array<ToolInfo & { serverName: string }> = [];
    
    for (const [serverName, { client }] of this.servers) {
      try {
        const tools = await client.listTools();
        allTools.push(...tools.map(tool => ({ ...tool, serverName })));
      } catch (error) {
        console.error(`Failed to get tools from server '${serverName}':`, error);
      }
    }
    
    return allTools;
  }

  /**
   * Call a tool on a specific server
   */
  async callToolOnServer(
    serverName: string, 
    toolName: string, 
    args?: any, 
    options?: CallOptions
  ): Promise<CallToolResult> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server '${serverName}' not found`);
    }
    
    return server.client.callTool(toolName, args, options);
  }

  /**
   * Get the best server for a tool (based on capabilities and priority)
   */
  async getBestServerForTool(toolName: string): Promise<string | null> {
    const allTools = await this.getAllTools();
    const toolServers = allTools
      .filter(tool => tool.name === toolName)
      .map(tool => {
        const serverConfig = this.servers.get(tool.serverName)?.config;
        return {
          serverName: tool.serverName,
          priority: serverConfig?.priority || 0
        };
      })
      .sort((a, b) => b.priority - a.priority);
    
    return toolServers.length > 0 ? toolServers[0].serverName : null;
  }

  /**
   * Disconnect all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.servers.values())
      .map(({ client }) => client.disconnect());
    
    await Promise.allSettled(disconnectPromises);
    this.servers.clear();
  }
}

/**
 * Factory interface for creating MCP clients
 */
export interface MCPClientFactory<TConfig extends ClientConfig = ClientConfig> {
  create(config: TConfig): IMCPClient;
  createAndConnect(config: TConfig): Promise<IMCPClient>;
}

// Export all types and classes
export {
  ConnectionState,
  type ProgressCallback,
  type ConnectionStateCallback,
  type MessageCallback,
  type CancellationToken,
  type CallOptions,
  type ServerConfig,
  type SessionContext,
  type IEnhancedMCPClient,
  type IMultiServerMCPClient
};
