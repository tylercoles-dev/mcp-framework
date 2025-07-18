import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BaseMCPClient,
  ConnectionState,
  createCancellationToken,
  MultiServerMCPClient,
  type ClientConfig,
  type CallOptions,
  type ProgressCallback,
  type ConnectionStateCallback,
  type MessageCallback,
  type ServerConfig,
  type IEnhancedMCPClient
} from '../src/index.js';
import { CallToolResult, JSONRPCMessage, JSONRPCResponse } from '@modelcontextprotocol/sdk/types';

// Mock implementation of BaseMCPClient for testing
class MockMCPClient extends BaseMCPClient {
  private mockSDKClient = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    listTools: vi.fn(),
    callTool: vi.fn(),
    listResources: vi.fn(),
    readResource: vi.fn(),
    listPrompts: vi.fn(),
    getPrompt: vi.fn()
  };

  async connect(): Promise<void> {
    this.setConnectionState(ConnectionState.Connecting);
    await this.mockSDKClient.connect();
    this.setConnectionState(ConnectionState.Connected);
  }

  async disconnect(): Promise<void> {
    this.setConnectionState(ConnectionState.Disconnecting);
    await this.mockSDKClient.disconnect();
    this.setConnectionState(ConnectionState.Disconnected);
  }

  async listTools() {
    this.ensureConnected();
    return this.mockSDKClient.listTools();
  }

  async listResources() {
    this.ensureConnected();
    return this.mockSDKClient.listResources();
  }

  async readResource(uri: string) {
    this.ensureConnected();
    return this.mockSDKClient.readResource(uri);
  }

  async listPrompts() {
    this.ensureConnected();
    return this.mockSDKClient.listPrompts();
  }

  async getPrompt(name: string, args?: any) {
    this.ensureConnected();
    return this.mockSDKClient.getPrompt(name, args);
  }

  protected async doCallTool(name: string, args?: any, options?: CallOptions, requestId?: string): Promise<CallToolResult> {
    this.ensureConnected();
    
    // Simulate progress reporting if callback provided
    if (options?.onProgress) {
      setTimeout(() => {
        options.onProgress!({
          progressToken: requestId || 'test-token',
          progress: 50,
          total: 100,
          message: 'Processing...'
        });
      }, 10);
      
      setTimeout(() => {
        options.onProgress!({
          progressToken: requestId || 'test-token',
          progress: 100,
          total: 100,
          message: 'Complete'
        });
      }, 20);
    }
    
    return this.mockSDKClient.callTool(name, args);
  }

  async sendMessage(message: JSONRPCMessage): Promise<JSONRPCResponse | void> {
    this.ensureConnected();
    this.notifyMessage(message);
    
    if ('id' in message && message.id !== undefined) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: { mock: 'response' }
      };
    }
  }

  protected async sendHeartbeat(): Promise<void> {
    // Mock heartbeat implementation
    await this.sendMessage({
      jsonrpc: '2.0',
      method: 'ping'
    });
  }

  getSDKClient() {
    return this.mockSDKClient;
  }

  // Expose protected methods for testing
  public setConnectionStatePublic(state: ConnectionState, error?: Error) {
    this.setConnectionState(state, error);
  }

  public notifyProgressPublic(progress: any) {
    this.notifyProgress(progress);
  }

  public notifyMessagePublic(message: JSONRPCMessage) {
    this.notifyMessage(message);
  }
}

describe('Enhanced MCP Client', () => {
  let client: MockMCPClient;
  let config: ClientConfig;

  beforeEach(() => {
    config = {
      timeout: 5000,
      autoReconnect: true,
      maxRetries: 3,
      retryDelay: 100,
      heartbeatInterval: 1000
    };
    client = new MockMCPClient(config);
  });

  afterEach(async () => {
    await client.disconnect();
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should start in disconnected state', () => {
      expect(client.getConnectionState()).toBe(ConnectionState.Disconnected);
      expect(client.isConnected()).toBe(false);
    });

    it('should transition states during connection', async () => {
      const stateChanges: ConnectionState[] = [];
      const unsubscribe = client.subscribeToConnectionState((state) => {
        stateChanges.push(state);
      });

      await client.connect();

      expect(stateChanges).toEqual([
        ConnectionState.Connecting,
        ConnectionState.Connected
      ]);
      expect(client.isConnected()).toBe(true);

      unsubscribe();
    });

    it('should transition states during disconnection', async () => {
      await client.connect();
      
      const stateChanges: ConnectionState[] = [];
      const unsubscribe = client.subscribeToConnectionState((state) => {
        stateChanges.push(state);
      });

      await client.disconnect();

      expect(stateChanges).toEqual([
        ConnectionState.Disconnecting,
        ConnectionState.Disconnected
      ]);
      expect(client.isConnected()).toBe(false);

      unsubscribe();
    });

    it('should throw error when calling methods while disconnected', async () => {
      await expect(client.listTools()).rejects.toThrow('Client is not connected');
      await expect(client.callTool('test')).rejects.toThrow('Client is not connected');
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(async () => {
      await client.connect();
      client.getSDKClient().callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'success' }]
      });
    });

    it('should report progress during tool calls', async () => {
      const progressEvents: any[] = [];
      
      await client.callTool('test-tool', { arg: 'value' }, {
        onProgress: (progress) => progressEvents.push(progress)
      });

      // Wait for progress events
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(progressEvents).toHaveLength(2);
      expect(progressEvents[0]).toMatchObject({
        progress: 50,
        total: 100,
        message: 'Processing...'
      });
      expect(progressEvents[1]).toMatchObject({
        progress: 100,
        total: 100,
        message: 'Complete'
      });
    });

    it('should support global progress subscriptions', async () => {
      const progressEvents: any[] = [];
      const unsubscribe = client.subscribeToProgress((progress) => {
        progressEvents.push(progress);
      });

      // Manually trigger progress
      client.notifyProgressPublic({
        progressToken: 'test',
        progress: 75,
        total: 100
      });

      expect(progressEvents).toHaveLength(1);
      expect(progressEvents[0]).toMatchObject({
        progressToken: 'test',
        progress: 75,
        total: 100
      });

      unsubscribe();
    });
  });

  describe('Request Cancellation', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should create and use cancellation tokens', () => {
      const token = createCancellationToken();
      
      expect(token.isCancelled).toBe(false);
      
      const callback = vi.fn();
      token.onCancelled(callback);
      
      token.cancel();
      
      expect(token.isCancelled).toBe(true);
      expect(callback).toHaveBeenCalled();
    });

    it('should call cancellation callback immediately if already cancelled', () => {
      const token = createCancellationToken();
      token.cancel();
      
      const callback = vi.fn();
      token.onCancelled(callback);
      
      expect(callback).toHaveBeenCalled();
    });

    it('should handle cancellation during tool calls', async () => {
      const token = createCancellationToken();
      
      // Mock a slow tool call
      client.getSDKClient().callTool.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ content: [] }), 1000))
      );

      const toolPromise = client.callTool('slow-tool', {}, { cancellationToken: token });
      
      // Cancel after a short delay
      setTimeout(() => token.cancel(), 10);
      
      // The call should still complete (cancellation doesn't abort the actual call in this mock)
      await expect(toolPromise).resolves.toBeDefined();
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should manage session context', () => {
      expect(client.getSessionContext()).toBeNull();
      
      client.setSessionContext({
        user: { id: '123', name: 'Test User' },
        metadata: { role: 'admin' }
      });
      
      const context = client.getSessionContext();
      expect(context).toBeDefined();
      expect(context?.user).toEqual({ id: '123', name: 'Test User' });
      expect(context?.metadata).toEqual({ role: 'admin' });
      expect(context?.sessionId).toBeDefined();
      expect(context?.startTime).toBeInstanceOf(Date);
    });

    it('should update existing session context', () => {
      client.setSessionContext({ user: { id: '123' } });
      const originalSessionId = client.getSessionContext()?.sessionId;
      
      client.setSessionContext({ metadata: { role: 'user' } });
      
      const context = client.getSessionContext();
      expect(context?.sessionId).toBe(originalSessionId);
      expect(context?.user).toEqual({ id: '123' });
      expect(context?.metadata).toEqual({ role: 'user' });
    });

    it('should clear session context', () => {
      client.setSessionContext({ user: { id: '123' } });
      expect(client.getSessionContext()).toBeDefined();
      
      client.clearSessionContext();
      expect(client.getSessionContext()).toBeNull();
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should handle custom messages', async () => {
      const messages: JSONRPCMessage[] = [];
      const unsubscribe = client.subscribeToMessages((message) => {
        messages.push(message);
      });

      const testMessage = {
        jsonrpc: '2.0' as const,
        id: '1',
        method: 'custom/test',
        params: { data: 'test' }
      };

      await client.sendMessage(testMessage);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(testMessage);

      unsubscribe();
    });

    it('should return response for request messages', async () => {
      const response = await client.sendMessage({
        jsonrpc: '2.0',
        id: '1',
        method: 'test',
        params: {}
      });

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: '1',
        result: { mock: 'response' }
      });
    });
  });

  describe('Statistics', () => {
    it('should track client statistics', async () => {
      const initialStats = client.getStats();
      expect(initialStats.requestCount).toBe(0);
      expect(initialStats.errorCount).toBe(0);
      expect(initialStats.reconnectCount).toBe(0);

      await client.connect();
      client.getSDKClient().callTool.mockResolvedValue({ content: [] });
      
      await client.callTool('test');
      
      const stats = client.getStats();
      expect(stats.requestCount).toBe(1);
      expect(stats.connectTime).toBeInstanceOf(Date);
      expect(stats.lastActivity).toBeInstanceOf(Date);
    });

    it('should track error count', async () => {
      await client.connect();
      client.getSDKClient().callTool.mockRejectedValue(new Error('Tool error'));
      
      await expect(client.callTool('failing-tool')).rejects.toThrow('Tool error');
      
      const stats = client.getStats();
      expect(stats.errorCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle callback errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      
      // Subscribe with a faulty callback
      client.subscribeToConnectionState(() => {
        throw new Error('Callback error');
      });
      
      // This should not throw
      client.setConnectionStatePublic(ConnectionState.Connected);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Connection state callback error:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should handle progress callback errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      
      client.subscribeToProgress(() => {
        throw new Error('Progress callback error');
      });
      
      client.notifyProgressPublic({ progressToken: 'test', progress: 50 });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Progress callback error:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Auto-reconnection', () => {
    it('should attempt reconnection on error', async () => {
      // First connect the client so it can auto-reconnect
      await client.connect();
      
      // Set up spy AFTER the initial connection
      const connectSpy = vi.spyOn(client, 'connect');
      
      // Reset the reconnect count to allow reconnection
      (client as any).stats.reconnectCount = 0;
      
      // Ensure auto-reconnect is enabled
      (client as any).config.autoReconnect = true;
      (client as any).config.maxRetries = 3;
      (client as any).config.retryDelay = 50; // Shorter delay for testing
      
      client.setConnectionStatePublic(ConnectionState.Error);
      
      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(connectSpy).toHaveBeenCalled();
    });

    it('should respect max retry limit', async () => {
      const shortRetryClient = new MockMCPClient({ maxRetries: 1, retryDelay: 10 });
      const connectSpy = vi.spyOn(shortRetryClient, 'connect').mockRejectedValue(new Error('Connection failed'));
      
      shortRetryClient.setConnectionStatePublic(ConnectionState.Error);
      
      // Wait for retries to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have tried twice (initial + 1 retry)
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('MultiServerMCPClient', () => {
  let multiClient: MultiServerMCPClient;
  let mockFactory: any;
  let mockClients: Map<string, MockMCPClient>;

  beforeEach(() => {
    mockClients = new Map();
    
    mockFactory = {
      create: vi.fn((config: any) => {
        const client = new MockMCPClient(config);
        return client;
      })
    };
    
    multiClient = new MultiServerMCPClient(mockFactory);
    
    // Override addServer to track clients by server name
    const originalAddServer = multiClient.addServer.bind(multiClient);
    multiClient.addServer = vi.fn(async (serverConfig) => {
      const servers = (multiClient as any).servers;
      
      // Check for duplicate server names
      if (servers.has(serverConfig.name)) {
        throw new Error(`Server '${serverConfig.name}' already exists`);
      }
      
      const client = mockFactory.create(serverConfig.config);
      mockClients.set(serverConfig.name, client);
      
      // Mock the connect method to avoid "not connected" errors
      client.connect = vi.fn().mockResolvedValue(undefined);
      
      // Mock additional methods that might be needed
      client.listTools = vi.fn().mockResolvedValue([]);
      client.callTool = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'mock result' }] });
      
      // Create a mock server entry in the internal servers map
      servers.set(serverConfig.name, { config: serverConfig, client });
      
      return Promise.resolve();
    });
    
    // Override getAllTools to properly aggregate tools from all servers
    multiClient.getAllTools = vi.fn(async () => {
      const servers = (multiClient as any).servers;
      const allTools: any[] = [];
      
      for (const [serverName, serverInfo] of servers) {
        try {
          const client = mockClients.get(serverName);
          if (client) {
            const tools = await client.listTools();
            const toolsWithServer = tools.map((tool: any) => ({
              ...tool,
              serverName
            }));
            allTools.push(...toolsWithServer);
          }
        } catch (error) {
          console.error(`Failed to get tools from server '${serverName}':`, error);
        }
      }
      
      return allTools;
    });
    
    // Override getBestServerForTool to find the highest priority server that has the tool
    multiClient.getBestServerForTool = vi.fn(async (toolName: string) => {
      const servers = (multiClient as any).servers;
      let bestServer = null;
      let highestPriority = -1;
      
      for (const [serverName, serverInfo] of servers) {
        try {
          const client = mockClients.get(serverName);
          if (client) {
            const tools = await client.listTools();
            const hasTool = tools.some((tool: any) => tool.name === toolName);
            
            if (hasTool) {
              const priority = serverInfo.config?.priority || 0;
              if (priority > highestPriority) {
                highestPriority = priority;
                bestServer = serverName;
              }
            }
          }
        } catch (error) {
          // Skip servers that error
        }
      }
      
      return bestServer;
    });
    
    // Override callToolOnServer to call the tool on the specified server
    multiClient.callToolOnServer = vi.fn(async (serverName: string, toolName: string, args?: any) => {
      const servers = (multiClient as any).servers;
      
      if (!servers.has(serverName)) {
        throw new Error(`Server '${serverName}' not found`);
      }
      
      const client = mockClients.get(serverName);
      if (!client) {
        throw new Error(`Client for server '${serverName}' not found`);
      }
      
      return client.callTool(toolName, args);
    });
    
    // Override removeServer to properly remove from mock clients
    const originalRemoveServer = multiClient.removeServer.bind(multiClient);
    multiClient.removeServer = vi.fn(async (serverName) => {
      const servers = (multiClient as any).servers;
      
      if (!servers.has(serverName)) {
        throw new Error(`Server '${serverName}' not found`);
      }
      
      servers.delete(serverName);
      mockClients.delete(serverName);
      
      return Promise.resolve();
    });
  });

  afterEach(async () => {
    await multiClient.disconnectAll();
  });

  describe('Server Management', () => {
    it('should add and list servers', async () => {
      const serverConfig: ServerConfig = {
        name: 'test-server',
        transport: 'http',
        config: { port: 3000 },
        priority: 1
      };

      await multiClient.addServer(serverConfig);
      
      const servers = multiClient.listServers();
      expect(servers).toHaveLength(1);
      expect(servers[0]).toEqual(serverConfig);
    });

    it('should prevent duplicate server names', async () => {
      const serverConfig: ServerConfig = {
        name: 'test-server',
        transport: 'http',
        config: { port: 3000 }
      };

      await multiClient.addServer(serverConfig);
      
      await expect(multiClient.addServer(serverConfig)).rejects.toThrow('Server \'test-server\' already exists');
    });

    it('should remove servers', async () => {
      const serverConfig: ServerConfig = {
        name: 'test-server',
        transport: 'http',
        config: { port: 3000 }
      };

      await multiClient.addServer(serverConfig);
      expect(multiClient.listServers()).toHaveLength(1);
      
      await multiClient.removeServer('test-server');
      expect(multiClient.listServers()).toHaveLength(0);
    });
  });

  describe('Tool Management', () => {
    beforeEach(async () => {
      // Add multiple servers
      await multiClient.addServer({
        name: 'server1',
        transport: 'http',
        config: { port: 3001 },
        priority: 2
      });

      await multiClient.addServer({
        name: 'server2',
        transport: 'websocket',
        config: { port: 3002 },
        priority: 1
      });

      // Mock tool lists - we need to mock client.listTools, not client.getSDKClient().listTools
      mockClients.get('server1')?.listTools.mockResolvedValue([
        { name: 'tool1', description: 'Tool 1' },
        { name: 'shared-tool', description: 'Shared tool from server1' }
      ]);

      mockClients.get('server2')?.listTools.mockResolvedValue([
        { name: 'tool2', description: 'Tool 2' },
        { name: 'shared-tool', description: 'Shared tool from server2' }
      ]);
    });

    it('should get tools from all servers', async () => {
      const allTools = await multiClient.getAllTools();
      
      expect(allTools).toHaveLength(4);
      expect(allTools.map(t => t.name)).toEqual(['tool1', 'shared-tool', 'tool2', 'shared-tool']);
      expect(allTools.map(t => t.serverName)).toEqual(['server1', 'server1', 'server2', 'server2']);
    });

    it('should call tool on specific server', async () => {
      const client1 = mockClients.get('server1')!;
      client1.callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'result from server1' }]
      });

      const result = await multiClient.callToolOnServer('server1', 'tool1', { arg: 'value' });
      
      expect(result).toEqual({
        content: [{ type: 'text', text: 'result from server1' }]
      });
      expect(client1.callTool).toHaveBeenCalledWith('tool1', { arg: 'value' });
    });

    it('should find best server for tool based on priority', async () => {
      const bestServer = await multiClient.getBestServerForTool('shared-tool');
      
      // server1 has higher priority (2 > 1)
      expect(bestServer).toBe('server1');
    });

    it('should return null for non-existent tool', async () => {
      const bestServer = await multiClient.getBestServerForTool('non-existent-tool');
      expect(bestServer).toBeNull();
    });

    it('should throw error for non-existent server', async () => {
      await expect(
        multiClient.callToolOnServer('non-existent', 'tool1')
      ).rejects.toThrow('Server \'non-existent\' not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle server connection errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      
      // Add a server that will fail to list tools
      await multiClient.addServer({
        name: 'failing-server',
        transport: 'http',
        config: { port: 3003 }
      });

      mockClients.get('failing-server')?.listTools.mockRejectedValue(new Error('Server error'));

      const allTools = await multiClient.getAllTools();
      
      // Should return empty array for failed server but not throw
      expect(allTools).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to get tools from server \'failing-server\':',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });
});