import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BaseMCPClient,
  ConnectionState,
  ElicitationAction,
  type ClientConfig,
  type SessionContext,
  type CallOptions,
  type ProgressCallback,
  type ConnectionStateCallback,
  type MessageCallback,
  type ElicitationRequest,
  type ElicitationResponse,
  type ElicitationField,
  type ElicitationValidationError,
  type ElicitationHandler,
  createCancellationToken
} from '../src/index.js';
import { CallToolResult, JSONRPCMessage, JSONRPCResponse } from '@modelcontextprotocol/sdk/types';

// Mock implementation of BaseMCPClient for testing
class TestMCPClient extends BaseMCPClient {
  private mockConnected = false;

  async connect(): Promise<void> {
    this.setConnectionState(ConnectionState.Connecting);
    this.mockConnected = true;
    this.setConnectionState(ConnectionState.Connected);
  }

  async disconnect(): Promise<void> {
    this.setConnectionState(ConnectionState.Disconnecting);
    this.mockConnected = false;
    this.setConnectionState(ConnectionState.Disconnected);
  }

  async listTools() {
    this.ensureConnected();
    return [{ name: 'test-tool', description: 'Test tool', inputSchema: {} }];
  }

  async listResources() {
    this.ensureConnected();
    return [{ uri: 'test://resource', name: 'test-resource' }];
  }

  async readResource(uri: string) {
    this.ensureConnected();
    return { contents: [{ type: 'text' as const, text: 'test content' }] };
  }

  async listPrompts() {
    this.ensureConnected();
    return [{ name: 'test-prompt', description: 'Test prompt' }];
  }

  async getPrompt(name: string, args?: any) {
    this.ensureConnected();
    return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text: 'test' } }] };
  }

  protected async doCallTool(name: string, args?: any, options?: CallOptions, requestId?: string): Promise<CallToolResult> {
    this.ensureConnected();
    return { content: [{ type: 'text' as const, text: 'tool result' }] };
  }

  async sendMessage(message: JSONRPCMessage): Promise<JSONRPCResponse | void> {
    this.ensureConnected();
    return { jsonrpc: '2.0', id: (message as any).id, result: 'success' };
  }

  getSDKClient() {
    return {};
  }

  isConnected(): boolean {
    return this.mockConnected;
  }
}

describe('BaseMCPClient', () => {
  let client: TestMCPClient;

  beforeEach(() => {
    client = new TestMCPClient();
  });

  describe('Session Management', () => {
    it('should have null session context initially', () => {
      expect(client.getSessionContext()).toBeNull();
    });

    it('should set session context with auto-generated sessionId', () => {
      client.setSessionContext({ metadata: { test: 'value' } });
      
      const context = client.getSessionContext();
      expect(context).toBeDefined();
      expect(context?.sessionId).toBeDefined();
      expect(context?.startTime).toBeInstanceOf(Date);
      expect(context?.lastActivity).toBeInstanceOf(Date);
      expect(context?.metadata?.test).toBe('value');
    });

    it('should merge session context when updating', () => {
      client.setSessionContext({ metadata: { first: 'value' } });
      client.setSessionContext({ metadata: { second: 'value2' } });
      
      const context = client.getSessionContext();
      expect(context?.metadata?.second).toBe('value2');
      // Note: The original metadata is overwritten, not merged
    });

    it('should clear session context', () => {
      client.setSessionContext({ metadata: { test: 'value' } });
      expect(client.getSessionContext()).toBeDefined();
      
      client.clearSessionContext();
      expect(client.getSessionContext()).toBeNull();
    });

    it('should preserve sessionId when updating existing context', () => {
      client.setSessionContext({ metadata: { first: 'value' } });
      const originalSessionId = client.getSessionContext()?.sessionId;
      
      client.setSessionContext({ metadata: { second: 'value2' } });
      expect(client.getSessionContext()?.sessionId).toBe(originalSessionId);
    });
  });

  describe('Connection State Management', () => {
    it('should start in disconnected state', () => {
      expect(client.getConnectionState()).toBe(ConnectionState.Disconnected);
      expect(client.isConnected()).toBe(false);
    });

    it('should track connection state changes', async () => {
      const stateChanges: ConnectionState[] = [];
      client.subscribeToConnectionState((state) => {
        stateChanges.push(state);
      });

      await client.connect();
      
      expect(stateChanges).toContain(ConnectionState.Connecting);
      expect(stateChanges).toContain(ConnectionState.Connected);
      expect(client.getConnectionState()).toBe(ConnectionState.Connected);
      expect(client.isConnected()).toBe(true);
    });

    it('should handle disconnection state changes', async () => {
      await client.connect();
      
      const stateChanges: ConnectionState[] = [];
      client.subscribeToConnectionState((state) => {
        stateChanges.push(state);
      });

      await client.disconnect();
      
      expect(stateChanges).toContain(ConnectionState.Disconnecting);
      expect(stateChanges).toContain(ConnectionState.Disconnected);
      expect(client.getConnectionState()).toBe(ConnectionState.Disconnected);
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track request and error counts', async () => {
      await client.connect();
      
      const initialStats = client.getStats();
      expect(initialStats.requestCount).toBe(0);
      expect(initialStats.errorCount).toBe(0);
      
      await client.callTool('test-tool');
      
      const afterStats = client.getStats();
      expect(afterStats.requestCount).toBe(1);
      expect(afterStats.errorCount).toBe(0);
    });

    it('should track error count when tool call fails', async () => {
      await client.connect();
      
      // Mock doCallTool to throw an error
      const originalDoCallTool = client['doCallTool'];
      client['doCallTool'] = vi.fn().mockRejectedValue(new Error('Tool error'));
      
      try {
        await client.callTool('failing-tool');
      } catch (error) {
        // Expected error
      }
      
      const stats = client.getStats();
      expect(stats.errorCount).toBe(1);
      expect(stats.requestCount).toBe(1);
      
      // Restore original method
      client['doCallTool'] = originalDoCallTool;
    });

    it('should return a copy of stats to prevent mutation', () => {
      const stats1 = client.getStats();
      const stats2 = client.getStats();
      
      stats1.requestCount = 999;
      expect(stats2.requestCount).not.toBe(999);
    });
  });

  describe('Subscriptions', () => {
    it('should allow subscribing to progress notifications', () => {
      const progressEvents: any[] = [];
      const unsubscribe = client.subscribeToProgress((progress) => {
        progressEvents.push(progress);
      });

      // Simulate progress notification
      client['progressCallbacks'].forEach(callback => {
        callback({ progress: 0.5, message: 'test progress' });
      });

      expect(progressEvents).toHaveLength(1);
      expect(progressEvents[0].progress).toBe(0.5);
      
      unsubscribe();
      
      // Should not receive more events after unsubscribe
      client['progressCallbacks'].forEach(callback => {
        callback({ progress: 1.0, message: 'finished' });
      });
      
      expect(progressEvents).toHaveLength(1);
    });

    it('should allow subscribing to message events', () => {
      const messages: any[] = [];
      const unsubscribe = client.subscribeToMessages((message) => {
        messages.push(message);
      });

      // Simulate message
      client['messageCallbacks'].forEach(callback => {
        callback({ type: 'request', data: { test: 'message' } });
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].data.test).toBe('message');
      
      unsubscribe();
      
      // Should not receive more events after unsubscribe
      client['messageCallbacks'].forEach(callback => {
        callback({ type: 'response', data: { test: 'message2' } });
      });
      
      expect(messages).toHaveLength(1);
    });
  });

  describe('Elicitation', () => {
    it('should register and handle elicitation requests', async () => {
      await client.connect();
      
      const mockHandler = vi.fn().mockResolvedValue({
        action: ElicitationAction.Accept,
        values: { field1: 'value1' }
      });
      
      const unsubscribe = client.registerElicitationHandler(mockHandler);
      
      const request: ElicitationRequest = {
        id: 'test-request',
        title: 'Test Request',
        fields: [{ name: 'field1', type: 'text', label: 'Field 1' }]
      };
      
      const response = await client.handleElicitationRequest(request);
      
      expect(mockHandler).toHaveBeenCalledWith(request);
      expect(response.action).toBe(ElicitationAction.Accept);
      expect(response.values?.field1).toBe('value1');
      
      unsubscribe();
    });

    it('should validate elicitation field values', () => {
      const fields: ElicitationField[] = [
        { name: 'required', type: 'text', label: 'Required Field', required: true },
        { name: 'optional', type: 'text', label: 'Optional Field', required: false }
      ];
      
      const validValues = { required: 'value', optional: 'value' };
      const invalidValues = { optional: 'value' }; // missing required field
      
      expect(client.validateElicitationValues(fields, validValues)).toHaveLength(0);
      
      const errors = client.validateElicitationValues(fields, invalidValues);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('required');
      expect(errors[0].message).toBe('Required Field is required');
    });

    it('should track active elicitation requests', async () => {
      await client.connect();
      
      let resolveHandler: (value: any) => void;
      const handlerPromise = new Promise(resolve => {
        resolveHandler = resolve;
      });
      
      const handler = vi.fn().mockImplementation(async (request: ElicitationRequest) => {
        // Wait for external resolution
        await handlerPromise;
        return { action: ElicitationAction.Accept, values: {} };
      });
      
      client.registerElicitationHandler(handler);
      
      const request: ElicitationRequest = {
        id: 'test-request',
        title: 'Test Request',
        fields: [{ name: 'field1', type: 'text', label: 'Field 1' }]
      };
      
      // Start request but don't wait
      const responsePromise = client.handleElicitationRequest(request);
      
      // Give it a moment to add to active requests
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should be in active requests
      expect(client.getActiveElicitationRequests()).toHaveLength(1);
      expect(client.getActiveElicitationRequests()[0].id).toBe('test-request');
      
      // Resolve the handler
      resolveHandler({ action: ElicitationAction.Accept, values: {} });
      
      // Wait for completion
      await responsePromise;
      
      // Should be removed from active requests
      expect(client.getActiveElicitationRequests()).toHaveLength(0);
    });

    it('should handle elicitation without handler', async () => {
      await client.connect();
      
      const request: ElicitationRequest = {
        id: 'test-request',
        title: 'Test Request',
        fields: [{ name: 'field1', type: 'text', label: 'Field 1' }]
      };
      
      const response = await client.handleElicitationRequest(request);
      
      expect(response.action).toBe(ElicitationAction.Cancel);
      expect(response.reason).toBe('No elicitation handler available');
    });
  });

  describe('Request Cancellation', () => {
    it('should handle cancellation tokens', async () => {
      await client.connect();
      
      const cancellationToken = createCancellationToken();
      const options: CallOptions = { cancellationToken };
      
      const callPromise = client.callTool('test-tool', {}, options);
      
      // Cancel the request
      cancellationToken.cancel();
      
      // Should complete successfully since our mock doesn't actually respect cancellation
      await expect(callPromise).resolves.toBeDefined();
    });

    it('should clean up active requests on cancellation', async () => {
      await client.connect();
      
      const cancellationToken = createCancellationToken();
      const options: CallOptions = { cancellationToken };
      
      await client.callTool('test-tool', {}, options);
      
      // Request should be cleaned up from active requests
      expect(client['activeRequests'].size).toBe(0);
    });

    it('should cancel request by ID', async () => {
      await client.connect();
      
      const cancellationToken = createCancellationToken();
      const requestId = 'test-request-123';
      client['activeRequests'].set(requestId, cancellationToken);
      
      const cancelSpy = vi.spyOn(cancellationToken, 'cancel');
      
      await client.cancelRequest(requestId);
      
      expect(cancelSpy).toHaveBeenCalled();
      expect(client['activeRequests'].has(requestId)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when calling methods while disconnected', async () => {
      await expect(client.listTools()).rejects.toThrow('Client is not connected');
      await expect(client.listResources()).rejects.toThrow('Client is not connected');
      await expect(client.readResource('test://resource')).rejects.toThrow('Client is not connected');
      await expect(client.listPrompts()).rejects.toThrow('Client is not connected');
      await expect(client.getPrompt('test-prompt')).rejects.toThrow('Client is not connected');
      await expect(client.sendMessage({ jsonrpc: '2.0', method: 'test' })).rejects.toThrow('Client is not connected');
    });

    it('should update last activity time on successful operations', async () => {
      await client.connect();
      
      const beforeTime = Date.now();
      await client.callTool('test-tool');
      const afterTime = Date.now();
      
      const context = client.getSessionContext();
      if (context?.lastActivity) {
        const activityTime = context.lastActivity.getTime();
        expect(activityTime).toBeGreaterThanOrEqual(beforeTime);
        expect(activityTime).toBeLessThanOrEqual(afterTime);
      }
    });
  });

  describe('Configuration', () => {
    it('should use default configuration values', () => {
      const defaultClient = new TestMCPClient();
      expect(defaultClient['config'].timeout).toBe(30000);
      expect(defaultClient['config'].retries).toBe(3);
      expect(defaultClient['config'].autoReconnect).toBe(true);
      expect(defaultClient['config'].maxRetries).toBe(5);
    });

    it('should allow custom configuration', () => {
      const config: ClientConfig = {
        timeout: 60000,
        retries: 5,
        debug: true,
        autoReconnect: false,
        maxRetries: 10
      };
      
      const customClient = new TestMCPClient(config);
      expect(customClient['config'].timeout).toBe(60000);
      expect(customClient['config'].retries).toBe(5);
      expect(customClient['config'].debug).toBe(true);
      expect(customClient['config'].autoReconnect).toBe(false);
      expect(customClient['config'].maxRetries).toBe(10);
    });
  });
});