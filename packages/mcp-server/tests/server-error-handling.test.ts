import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPServer, MCPErrorFactory, MCPErrorCode } from '../src/index.js';
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

describe('MCPServer Error Handling', () => {
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

  describe('Tool Registration Error Handling', () => {
    it('should throw error for empty tool name', () => {
      const toolHandler = vi.fn();
      
      expect(() => {
        server.registerTool('', {
          description: 'Test tool',
          inputSchema: { name: z.string() }
        }, toolHandler);
      }).toThrow(MCPErrorFactory.invalidParams('Tool name must be a non-empty string'));
    });

    it('should throw error for non-string tool name', () => {
      const toolHandler = vi.fn();
      
      expect(() => {
        server.registerTool(null as any, {
          description: 'Test tool',
          inputSchema: { name: z.string() }
        }, toolHandler);
      }).toThrow(MCPErrorFactory.invalidParams('Tool name must be a non-empty string'));
    });

    it('should throw error for duplicate tool name', () => {
      const toolHandler = vi.fn();
      const toolConfig = {
        description: 'Test tool',
        inputSchema: { name: z.string() }
      };
      
      server.registerTool('test-tool', toolConfig, toolHandler);
      
      expect(() => {
        server.registerTool('test-tool', toolConfig, toolHandler);
      }).toThrow(MCPErrorFactory.invalidParams('Tool \'test-tool\' is already registered'));
    });

    it('should wrap handler errors in MCP error format', async () => {
      const toolHandler = vi.fn().mockRejectedValue(new Error('Tool execution failed'));
      
      server.registerTool('test-tool', {
        description: 'Test tool',
        inputSchema: { name: z.string() }
      }, toolHandler);

      // Get the wrapped handler that was registered with the SDK
      const registeredHandler = mockSDKServer.registerTool.mock.calls[0][2];
      
      await expect(registeredHandler({ name: 'test' }, {})).rejects.toThrow();
      
      try {
        await registeredHandler({ name: 'test' }, {});
      } catch (error) {
        expect(error.code).toBe(MCPErrorCode.InternalError);
        expect(error.message).toBe('Tool execution failed');
        expect(error.data?.type).toBe('wrapped_error');
      }
    });

    it('should preserve MCP errors from handler', async () => {
      const mcpError = MCPErrorFactory.resourceNotFound('file:///test.txt');
      const toolHandler = vi.fn().mockRejectedValue(mcpError);
      
      server.registerTool('test-tool', {
        description: 'Test tool',
        inputSchema: { name: z.string() }
      }, toolHandler);

      const registeredHandler = mockSDKServer.registerTool.mock.calls[0][2];
      
      await expect(registeredHandler({ name: 'test' }, {})).rejects.toThrow(mcpError);
    });
  });

  describe('Resource Registration Error Handling', () => {
    it('should throw error for empty resource name', () => {
      const resourceHandler = vi.fn();
      
      expect(() => {
        server.registerResource('', 'file:///test.txt', {
          title: 'Test Resource'
        }, resourceHandler);
      }).toThrow(MCPErrorFactory.invalidParams('Resource name must be a non-empty string'));
    });

    it('should throw error for non-string resource name', () => {
      const resourceHandler = vi.fn();
      
      expect(() => {
        server.registerResource(undefined as any, 'file:///test.txt', {
          title: 'Test Resource'
        }, resourceHandler);
      }).toThrow(MCPErrorFactory.invalidParams('Resource name must be a non-empty string'));
    });

    it('should throw error for duplicate resource name', () => {
      const resourceHandler = vi.fn();
      const resourceConfig = { title: 'Test Resource' };
      
      server.registerResource('test-resource', 'file:///test.txt', resourceConfig, resourceHandler);
      
      expect(() => {
        server.registerResource('test-resource', 'file:///test2.txt', resourceConfig, resourceHandler);
      }).toThrow(MCPErrorFactory.invalidParams('Resource \'test-resource\' is already registered'));
    });

    it('should wrap handler errors in MCP error format', async () => {
      const resourceHandler = vi.fn().mockRejectedValue(new Error('Resource access failed'));
      
      server.registerResource('test-resource', 'file:///test.txt', {
        title: 'Test Resource'
      }, resourceHandler);

      // Get the wrapped handler that was registered with the SDK
      const registeredHandler = mockSDKServer.registerResource.mock.calls[0][3];
      
      await expect(registeredHandler(new URL('file:///test.txt'))).rejects.toThrow();
      
      try {
        await registeredHandler(new URL('file:///test.txt'));
      } catch (error) {
        expect(error.code).toBe(MCPErrorCode.InternalError);
        expect(error.message).toBe('Resource access failed');
        expect(error.data?.type).toBe('wrapped_error');
      }
    });
  });

  describe('Prompt Registration Error Handling', () => {
    it('should throw error for empty prompt name', () => {
      const promptHandler = vi.fn();
      
      expect(() => {
        server.registerPrompt('', {
          title: 'Test Prompt',
          description: 'Test prompt description'
        }, promptHandler);
      }).toThrow(MCPErrorFactory.invalidParams('Prompt name must be a non-empty string'));
    });

    it('should throw error for non-string prompt name', () => {
      const promptHandler = vi.fn();
      
      expect(() => {
        server.registerPrompt(123 as any, {
          title: 'Test Prompt',
          description: 'Test prompt description'
        }, promptHandler);
      }).toThrow(MCPErrorFactory.invalidParams('Prompt name must be a non-empty string'));
    });

    it('should throw error for duplicate prompt name', () => {
      const promptHandler = vi.fn();
      const promptConfig = {
        title: 'Test Prompt',
        description: 'Test prompt description'
      };
      
      server.registerPrompt('test-prompt', promptConfig, promptHandler);
      
      expect(() => {
        server.registerPrompt('test-prompt', promptConfig, promptHandler);
      }).toThrow(MCPErrorFactory.invalidParams('Prompt \'test-prompt\' is already registered'));
    });

    it('should wrap handler errors in MCP error format', async () => {
      const promptHandler = vi.fn().mockImplementation(() => {
        throw new Error('Prompt execution failed');
      });
      
      server.registerPrompt('test-prompt', {
        title: 'Test Prompt',
        description: 'Test prompt description'
      }, promptHandler);

      // Get the wrapped handler that was registered with the SDK
      const registeredHandler = mockSDKServer.registerPrompt.mock.calls[0][2];
      
      await expect(registeredHandler({})).rejects.toThrow();
      
      try {
        await registeredHandler({});
      } catch (error) {
        expect(error.code).toBe(MCPErrorCode.InternalError);
        expect(error.message).toBe('Prompt execution failed');
        expect(error.data?.type).toBe('wrapped_error');
      }
    });
  });

  describe('Getter Methods Error Handling', () => {
    it('should throw error for invalid tool name in getTool', () => {
      expect(() => {
        server.getTool('');
      }).toThrow(MCPErrorFactory.invalidParams('Tool name must be a non-empty string'));

      expect(() => {
        server.getTool(null as any);
      }).toThrow(MCPErrorFactory.invalidParams('Tool name must be a non-empty string'));
    });

    it('should throw error for invalid resource name in getResource', () => {
      expect(() => {
        server.getResource('');
      }).toThrow(MCPErrorFactory.invalidParams('Resource name must be a non-empty string'));

      expect(() => {
        server.getResource(undefined as any);
      }).toThrow(MCPErrorFactory.invalidParams('Resource name must be a non-empty string'));
    });

    it('should throw error for invalid prompt name in getPrompt', () => {
      expect(() => {
        server.getPrompt('');
      }).toThrow(MCPErrorFactory.invalidParams('Prompt name must be a non-empty string'));

      expect(() => {
        server.getPrompt(42 as any);
      }).toThrow(MCPErrorFactory.invalidParams('Prompt name must be a non-empty string'));
    });

    it('should return undefined for non-existent items', () => {
      expect(server.getTool('non-existent')).toBeUndefined();
      expect(server.getResource('non-existent')).toBeUndefined();
      expect(server.getPrompt('non-existent')).toBeUndefined();
    });

    it('should return existing items correctly', () => {
      const toolHandler = vi.fn();
      const resourceHandler = vi.fn();
      const promptHandler = vi.fn();

      server.registerTool('test-tool', {
        description: 'Test tool',
        inputSchema: { name: z.string() }
      }, toolHandler);

      server.registerResource('test-resource', 'file:///test.txt', {
        title: 'Test Resource'
      }, resourceHandler);

      server.registerPrompt('test-prompt', {
        title: 'Test Prompt',
        description: 'Test prompt description'
      }, promptHandler);

      const tool = server.getTool('test-tool');
      expect(tool).toEqual({
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: { name: z.string() },
        title: undefined
      });

      const resource = server.getResource('test-resource');
      expect(resource).toEqual({
        name: 'test-resource',
        uri: 'file:///test.txt',
        title: 'Test Resource',
        description: undefined,
        mimeType: undefined
      });

      const prompt = server.getPrompt('test-prompt');
      expect(prompt).toEqual({
        name: 'test-prompt',
        title: 'Test Prompt',
        description: 'Test prompt description',
        arguments: []
      });
    });
  });

  describe('Error Consistency', () => {
    it('should throw consistent error types', () => {
      const toolHandler = vi.fn();
      
      try {
        server.registerTool('', { description: 'Test', inputSchema: {} }, toolHandler);
      } catch (error) {
        expect(error.code).toBe(MCPErrorCode.InvalidParams);
        expect(error.data?.type).toBe('invalid_params');
      }

      try {
        server.registerTool('test', { description: 'Test', inputSchema: {} }, toolHandler);
        server.registerTool('test', { description: 'Test', inputSchema: {} }, toolHandler);
      } catch (error) {
        expect(error.code).toBe(MCPErrorCode.InvalidParams);
        expect(error.data?.type).toBe('invalid_params');
      }
    });
  });
});