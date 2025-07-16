import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPServer } from '../src/index.js';
import { z } from 'zod';

// Mock the SDK server
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    registerTool: vi.fn(),
    registerResource: vi.fn(),
    registerPrompt: vi.fn(),
    notification: vi.fn()
  }))
}));

describe('MCPServer Notifications', () => {
  let server: MCPServer;
  let mockSDKServer: any;

  beforeEach(() => {
    server = new MCPServer({
      name: 'test-server',
      version: '1.0.0'
    });
    mockSDKServer = server.getSDKServer();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Progress Notifications', () => {
    it('should send progress notification with all parameters', async () => {
      const progressToken = 'test-token';
      const progress = 50;
      const total = 100;
      const message = 'Processing...';

      await server.sendProgressNotification(progressToken, progress, total, message);

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken,
          progress,
          total,
          message
        }
      });
    });

    it('should send progress notification with minimal parameters', async () => {
      const progressToken = 'test-token';
      const progress = 75;

      await server.sendProgressNotification(progressToken, progress);

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken,
          progress,
          total: undefined,
          message: undefined
        }
      });
    });

    it('should handle numeric progress tokens', async () => {
      const progressToken = 12345;
      const progress = 25;

      await server.sendProgressNotification(progressToken, progress);

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken,
          progress,
          total: undefined,
          message: undefined
        }
      });
    });
  });

  describe('Logging Notifications', () => {
    it('should send log notification with all parameters', async () => {
      const level = 'info';
      const data = { message: 'Test log message', context: 'test' };
      const logger = 'test-logger';

      await server.sendLogNotification(level, data, logger);

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/message',
        params: {
          level,
          logger,
          data
        }
      });
    });

    it('should send log notification without logger', async () => {
      const level = 'error';
      const data = 'Error message';

      await server.sendLogNotification(level, data);

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/message',
        params: {
          level,
          logger: undefined,
          data
        }
      });
    });

    it('should support all log levels', async () => {
      const levels = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'] as const;
      
      for (const level of levels) {
        await server.sendLogNotification(level, `Test ${level} message`);
        
        expect(mockSDKServer.notification).toHaveBeenCalledWith({
          method: 'notifications/message',
          params: {
            level,
            logger: undefined,
            data: `Test ${level} message`
          }
        });
      }
    });
  });

  describe('Cancellation Notifications', () => {
    it('should send cancellation notification with reason', async () => {
      const requestId = 'req-123';
      const reason = 'User cancelled';

      await server.sendCancellationNotification(requestId, reason);

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/cancelled',
        params: {
          requestId,
          reason
        }
      });
    });

    it('should send cancellation notification without reason', async () => {
      const requestId = 'req-456';

      await server.sendCancellationNotification(requestId);

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/cancelled',
        params: {
          requestId,
          reason: undefined
        }
      });
    });
  });

  describe('Resource Notifications', () => {
    it('should send resource list changed notification', async () => {
      await server.sendResourceListChangedNotification();

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/resources/list_changed',
        params: {}
      });
    });

    it('should send resource updated notification', async () => {
      const uri = 'file:///test/resource.txt';

      await server.sendResourceUpdatedNotification(uri);

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/resources/updated',
        params: {
          uri
        }
      });
    });
  });

  describe('Tool Notifications', () => {
    it('should send tool list changed notification', async () => {
      await server.sendToolListChangedNotification();

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/tools/list_changed',
        params: {}
      });
    });
  });

  describe('Prompt Notifications', () => {
    it('should send prompt list changed notification', async () => {
      await server.sendPromptListChangedNotification();

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/prompts/list_changed',
        params: {}
      });
    });
  });

  describe('Automatic Notifications on Registration', () => {
    let mockTransport: any;

    beforeEach(async () => {
      mockTransport = {
        start: vi.fn(),
        stop: vi.fn()
      };
      
      server.useTransport(mockTransport);
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it('should send tool list changed notification when tool is registered', async () => {
      const toolHandler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test result' }]
      });

      server.registerTool('test-tool', {
        description: 'Test tool',
        inputSchema: { name: z.string() }
      }, toolHandler);

      // Give it a moment for the async notification to be sent
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/tools/list_changed',
        params: {}
      });
    });

    it('should send resource list changed notification when resource is registered', async () => {
      const resourceHandler = vi.fn().mockResolvedValue({
        contents: [{ uri: 'file:///test.txt', text: 'Test content' }]
      });

      server.registerResource('test-resource', 'file:///test.txt', {
        title: 'Test Resource',
        description: 'Test resource description'
      }, resourceHandler);

      // Give it a moment for the async notification to be sent
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/resources/list_changed',
        params: {}
      });
    });

    it('should send prompt list changed notification when prompt is registered', async () => {
      const promptHandler = vi.fn().mockReturnValue({
        messages: [{ role: 'user', content: { type: 'text', text: 'Test prompt' } }]
      });

      server.registerPrompt('test-prompt', {
        title: 'Test Prompt',
        description: 'Test prompt description'
      }, promptHandler);

      // Give it a moment for the async notification to be sent
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockSDKServer.notification).toHaveBeenCalledWith({
        method: 'notifications/prompts/list_changed',
        params: {}
      });
    });

    it('should not send notifications when server is not started', async () => {
      await server.stop();
      
      const toolHandler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test result' }]
      });

      server.registerTool('test-tool-2', {
        description: 'Test tool 2',
        inputSchema: { name: z.string() }
      }, toolHandler);

      // Give it a moment to ensure no async notifications are sent
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should only have the previous notifications, not this one
      expect(mockSDKServer.notification).not.toHaveBeenCalledWith({
        method: 'notifications/tools/list_changed',
        params: {}
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle notification errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      mockSDKServer.notification.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(server.sendProgressNotification('token', 50)).resolves.not.toThrow();
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle registration notification errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      mockSDKServer.notification.mockRejectedValue(new Error('Network error'));

      let mockTransport: any = {
        start: vi.fn(),
        stop: vi.fn()
      };
      
      server.useTransport(mockTransport);
      await server.start();

      const toolHandler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test result' }]
      });

      // Should not throw
      expect(() => server.registerTool('test-tool', {
        description: 'Test tool',
        inputSchema: { name: z.string() }
      }, toolHandler)).not.toThrow();

      await server.stop();
      consoleErrorSpy.mockRestore();
    });
  });
});