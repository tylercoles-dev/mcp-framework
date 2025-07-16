import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPServer, MCPErrorFactory, MCPErrorCode } from '../src/index.js';
import type { 
  SamplingConfig,
  SamplingHandler,
  SamplingRequest,
  SamplingResponse,
  SamplingMessage,
  ModelPreferences
} from '../src/index.js';

// Mock the SDK server
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    registerTool: vi.fn(),
    registerResource: vi.fn(),
    registerPrompt: vi.fn(),
    notification: vi.fn(),
    setRequestHandler: vi.fn()
  }))
}));

describe('MCP Sampling System', () => {
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

  describe('Sampling Registration', () => {
    it('should register basic sampling configuration', () => {
      const mockHandler: SamplingHandler = vi.fn().mockResolvedValue({
        role: 'assistant',
        content: {
          type: 'text',
          text: 'Test response'
        }
      });

      const config: SamplingConfig = {
        createMessage: mockHandler,
        includeContext: true,
        supportedModels: ['gpt-4', 'claude-3'],
        maxTokensLimit: 4096
      };

      expect(() => {
        server.registerSampling(config);
      }).not.toThrow();

      expect(server.isSamplingAvailable()).toBe(true);
      
      const samplingInfo = server.getSamplingInfo();
      expect(samplingInfo).toEqual({
        includeContext: true,
        supportedModels: ['gpt-4', 'claude-3'],
        maxTokensLimit: 4096
      });
    });

    it('should register sampling with temperature range', () => {
      const mockHandler: SamplingHandler = vi.fn().mockResolvedValue({
        role: 'assistant',
        content: { type: 'text', text: 'Response' }
      });

      const config: SamplingConfig = {
        createMessage: mockHandler,
        temperatureRange: { min: 0.1, max: 1.5 },
        metadata: { provider: 'openai' }
      };

      server.registerSampling(config);

      const samplingInfo = server.getSamplingInfo();
      expect(samplingInfo?.temperatureRange).toEqual({ min: 0.1, max: 1.5 });
      expect(samplingInfo?.metadata).toEqual({ provider: 'openai' });
    });

    it('should register request handler with SDK server', () => {
      const mockHandler: SamplingHandler = vi.fn().mockResolvedValue({
        role: 'assistant',
        content: { type: 'text', text: 'Response' }
      });

      server.registerSampling({ createMessage: mockHandler });

      expect(mockSDKServer.setRequestHandler).toHaveBeenCalledTimes(1);
      expect(mockSDKServer.setRequestHandler).toHaveBeenCalledWith(
        expect.any(Object), // Zod schema
        expect.any(Function) // Handler function
      );
    });
  });

  describe('Sampling Validation', () => {
    it('should throw error for missing createMessage handler', () => {
      expect(() => {
        server.registerSampling({
          createMessage: undefined as any
        });
      }).toThrow(MCPErrorFactory.invalidParams('Sampling createMessage handler must be a function'));
    });

    it('should throw error for non-function createMessage', () => {
      expect(() => {
        server.registerSampling({
          createMessage: 'not a function' as any
        });
      }).toThrow(MCPErrorFactory.invalidParams('Sampling createMessage handler must be a function'));
    });

    it('should validate temperature range', () => {
      const mockHandler: SamplingHandler = vi.fn();

      expect(() => {
        server.registerSampling({
          createMessage: mockHandler,
          temperatureRange: { min: -1, max: 1 }
        });
      }).toThrow(MCPErrorFactory.invalidParams('Invalid temperature range: must be between 0-2 and min <= max'));

      expect(() => {
        server.registerSampling({
          createMessage: mockHandler,
          temperatureRange: { min: 1, max: 3 }
        });
      }).toThrow(MCPErrorFactory.invalidParams('Invalid temperature range: must be between 0-2 and min <= max'));

      expect(() => {
        server.registerSampling({
          createMessage: mockHandler,
          temperatureRange: { min: 1.5, max: 1.0 }
        });
      }).toThrow(MCPErrorFactory.invalidParams('Invalid temperature range: must be between 0-2 and min <= max'));
    });

    it('should validate max tokens limit', () => {
      const mockHandler: SamplingHandler = vi.fn();

      expect(() => {
        server.registerSampling({
          createMessage: mockHandler,
          maxTokensLimit: -100
        });
      }).toThrow(MCPErrorFactory.invalidParams('Max tokens limit must be a positive number'));

      expect(() => {
        server.registerSampling({
          createMessage: mockHandler,
          maxTokensLimit: 0
        });
      }).toThrow(MCPErrorFactory.invalidParams('Max tokens limit must be a positive number'));
    });
  });

  describe('Sampling Request Handling', () => {
    let mockHandler: SamplingHandler;

    beforeEach(() => {
      mockHandler = vi.fn().mockResolvedValue({
        role: 'assistant',
        content: {
          type: 'text',
          text: 'This is a test response from the sampling system.'
        },
        stopReason: 'endTurn',
        usage: {
          inputTokens: 50,
          outputTokens: 15,
          totalTokens: 65
        }
      });

      server.registerSampling({
        createMessage: mockHandler,
        includeContext: true,
        maxTokensLimit: 4096,
        temperatureRange: { min: 0.0, max: 2.0 }
      });
    });

    it('should handle basic sampling request', async () => {
      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: 'Hello, how are you?'
          }
        }],
        maxTokens: 100,
        temperature: 0.7
      };

      const response = await server.createSamplingMessage(request);

      expect(response).toEqual({
        role: 'assistant',
        content: {
          type: 'text',
          text: 'This is a test response from the sampling system.'
        },
        stopReason: 'endTurn',
        usage: {
          inputTokens: 50,
          outputTokens: 15,
          totalTokens: 65
        }
      });

      expect(mockHandler).toHaveBeenCalledWith(\n        expect.objectContaining({\n          messages: request.messages,\n          maxTokens: 100,\n          temperature: 0.7\n        })\n      );
    });

    it('should handle request with model preferences', async () => {
      const modelPreferences: ModelPreferences = {\n        hints: ['be concise', 'use technical language'],\n        costPriority: 0.3,\n        speedPriority: 0.8,\n        intelligencePriority: 0.9\n      };\n\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: { type: 'text', text: 'Explain quantum computing' }\n        }],\n        modelPreferences,\n        systemPrompt: 'You are a helpful technical assistant.'\n      };\n\n      await server.createSamplingMessage(request);\n\n      expect(mockHandler).toHaveBeenCalledWith(\n        expect.objectContaining({\n          modelPreferences,\n          systemPrompt: 'You are a helpful technical assistant.'\n        })\n      );\n    });\n\n    it('should handle multi-modal messages', async () => {\n      const request: SamplingRequest = {\n        messages: [\n          {\n            role: 'user',\n            content: {\n              type: 'text',\n              text: 'What do you see in this image?'\n            }\n          },\n          {\n            role: 'user',\n            content: {\n              type: 'image',\n              data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',\n              mimeType: 'image/png'\n            }\n          }\n        ]\n      };\n\n      await server.createSamplingMessage(request);\n\n      expect(mockHandler).toHaveBeenCalledWith(\n        expect.objectContaining({\n          messages: request.messages\n        })\n      );\n    });\n\n    it('should add server context when includeContext is true', async () => {\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: { type: 'text', text: 'Hello' }\n        }],\n        includeContext: true\n      };\n\n      await server.createSamplingMessage(request);\n\n      expect(mockHandler).toHaveBeenCalledWith(\n        expect.objectContaining({\n          metadata: expect.objectContaining({\n            serverContext: expect.objectContaining({\n              name: 'test-server',\n              version: '1.0.0',\n              capabilities: expect.any(Object),\n              timestamp: expect.any(String)\n            })\n          })\n        })\n      );\n    });\n\n    it('should apply default temperature from server range', async () => {\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: { type: 'text', text: 'Hello' }\n        }]\n        // No temperature specified\n      };\n\n      await server.createSamplingMessage(request);\n\n      expect(mockHandler).toHaveBeenCalledWith(\n        expect.objectContaining({\n          temperature: 1.0 // (0.0 + 2.0) / 2\n        })\n      );\n    });\n  });\n\n  describe('Request Validation', () => {\n    beforeEach(() => {\n      const mockHandler: SamplingHandler = vi.fn().mockResolvedValue({\n        role: 'assistant',\n        content: { type: 'text', text: 'Response' }\n      });\n\n      server.registerSampling({\n        createMessage: mockHandler,\n        maxTokensLimit: 1000,\n        temperatureRange: { min: 0.1, max: 1.8 }\n      });\n    });\n\n    it('should validate required messages array', async () => {\n      const invalidRequests = [\n        { messages: [] },\n        { messages: undefined as any },\n        { messages: 'not an array' as any }\n      ];\n\n      for (const request of invalidRequests) {\n        await expect(server.createSamplingMessage(request as any)).rejects.toThrow(\n          expect.objectContaining({\n            message: expect.stringContaining('must include at least one message')\n          })\n        );\n      }\n    });\n\n    it('should validate message roles', async () => {\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'invalid' as any,\n          content: { type: 'text', text: 'Hello' }\n        }]\n      };\n\n      await expect(server.createSamplingMessage(request)).rejects.toThrow(\n        expect.objectContaining({\n          message: expect.stringContaining('Invalid role at message 0')\n        })\n      );\n    });\n\n    it('should validate message content types', async () => {\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: {\n            type: 'invalid' as any,\n            text: 'Hello'\n          }\n        }]\n      };\n\n      await expect(server.createSamplingMessage(request)).rejects.toThrow(\n        expect.objectContaining({\n          message: expect.stringContaining('Invalid content type at message 0')\n        })\n      );\n    });\n\n    it('should validate text message content', async () => {\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: {\n            type: 'text'\n            // Missing text field\n          } as any\n        }]\n      };\n\n      await expect(server.createSamplingMessage(request)).rejects.toThrow(\n        expect.objectContaining({\n          message: expect.stringContaining('Text message at index 0 must have text content')\n        })\n      );\n    });\n\n    it('should validate image message content', async () => {\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: {\n            type: 'image',\n            data: 'base64data'\n            // Missing mimeType\n          } as any\n        }]\n      };\n\n      await expect(server.createSamplingMessage(request)).rejects.toThrow(\n        expect.objectContaining({\n          message: expect.stringContaining('Image message at index 0 must have data and mimeType')\n        })\n      );\n    });\n\n    it('should validate model preferences ranges', async () => {\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: { type: 'text', text: 'Hello' }\n        }],\n        modelPreferences: {\n          costPriority: 1.5 // Invalid: > 1\n        }\n      };\n\n      await expect(server.createSamplingMessage(request)).rejects.toThrow(\n        expect.objectContaining({\n          message: expect.stringContaining('Cost priority must be between 0 and 1')\n        })\n      );\n    });\n\n    it('should validate temperature against server limits', async () => {\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: { type: 'text', text: 'Hello' }\n        }],\n        temperature: 2.0 // Outside server range of 0.1-1.8\n      };\n\n      await expect(server.createSamplingMessage(request)).rejects.toThrow(\n        expect.objectContaining({\n          message: expect.stringContaining('Temperature must be between 0.1 and 1.8')\n        })\n      );\n    });\n\n    it('should validate max tokens against server limits', async () => {\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: { type: 'text', text: 'Hello' }\n        }],\n        maxTokens: 2000 // Exceeds server limit of 1000\n      };\n\n      await expect(server.createSamplingMessage(request)).rejects.toThrow(\n        expect.objectContaining({\n          message: expect.stringContaining('Max tokens cannot exceed 1000')\n        })\n      );\n    });\n  });\n\n  describe('Response Validation', () => {\n    it('should validate sampling response format', async () => {\n      const invalidHandler: SamplingHandler = vi.fn().mockResolvedValue({\n        role: 'user', // Invalid: should be 'assistant'\n        content: { type: 'text', text: 'Response' }\n      });\n\n      server.registerSampling({ createMessage: invalidHandler });\n\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: { type: 'text', text: 'Hello' }\n        }]\n      };\n\n      await expect(server.createSamplingMessage(request)).rejects.toThrow(\n        expect.objectContaining({\n          message: expect.stringContaining('Sampling response role must be assistant')\n        })\n      );\n    });\n\n    it('should validate response content format', async () => {\n      const invalidHandler: SamplingHandler = vi.fn().mockResolvedValue({\n        role: 'assistant',\n        content: {\n          type: 'image', // Invalid: should be 'text'\n          text: 'Response'\n        } as any\n      });\n\n      server.registerSampling({ createMessage: invalidHandler });\n\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: { type: 'text', text: 'Hello' }\n        }]\n      };\n\n      await expect(server.createSamplingMessage(request)).rejects.toThrow(\n        expect.objectContaining({\n          message: expect.stringContaining('Sampling response content must be text type')\n        })\n      );\n    });\n\n    it('should validate usage statistics format', async () => {\n      const invalidHandler: SamplingHandler = vi.fn().mockResolvedValue({\n        role: 'assistant',\n        content: { type: 'text', text: 'Response' },\n        usage: {\n          inputTokens: -10 // Invalid: negative\n        }\n      });\n\n      server.registerSampling({ createMessage: invalidHandler });\n\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: { type: 'text', text: 'Hello' }\n        }]\n      };\n\n      await expect(server.createSamplingMessage(request)).rejects.toThrow(\n        expect.objectContaining({\n          message: expect.stringContaining('Invalid input tokens count')\n        })\n      );\n    });\n  });\n\n  describe('Error Handling', () => {\n    it('should handle sampling when not configured', async () => {\n      // Don't register sampling\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: { type: 'text', text: 'Hello' }\n        }]\n      };\n\n      await expect(server.createSamplingMessage(request)).rejects.toThrow(\n        MCPErrorFactory.invalidRequest('Sampling is not configured on this server')\n      );\n    });\n\n    it('should handle handler errors gracefully', async () => {\n      const faultyHandler: SamplingHandler = vi.fn().mockRejectedValue(\n        new Error('Model API error')\n      );\n\n      server.registerSampling({ createMessage: faultyHandler });\n\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: { type: 'text', text: 'Hello' }\n        }]\n      };\n\n      await expect(server.createSamplingMessage(request)).rejects.toThrow(\n        expect.objectContaining({\n          message: expect.stringContaining('Sampling failed: Model API error')\n        })\n      );\n    });\n\n    it('should handle unknown handler errors', async () => {\n      const faultyHandler: SamplingHandler = vi.fn().mockRejectedValue(\n        'Unknown error type'\n      );\n\n      server.registerSampling({ createMessage: faultyHandler });\n\n      const request: SamplingRequest = {\n        messages: [{\n          role: 'user',\n          content: { type: 'text', text: 'Hello' }\n        }]\n      };\n\n      await expect(server.createSamplingMessage(request)).rejects.toThrow(\n        expect.objectContaining({\n          message: expect.stringContaining('Sampling failed with unknown error')\n        })\n      );\n    });\n  });\n\n  describe('Capabilities Integration', () => {\n    it('should include sampling in capabilities when configured', () => {\n      const mockHandler: SamplingHandler = vi.fn();\n      \n      server.registerSampling({\n        createMessage: mockHandler,\n        includeContext: true,\n        supportedModels: ['gpt-4']\n      });\n\n      const capabilities = server.getCapabilities();\n      \n      expect(capabilities.sampling).toBeDefined();\n      expect(capabilities.sampling?.includeContext).toBe(true);\n      expect(capabilities.sampling?.supportedModels).toEqual(['gpt-4']);\n    });\n\n    it('should not include sampling in capabilities when not configured', () => {\n      const capabilities = server.getCapabilities();\n      \n      expect(capabilities.sampling).toBeUndefined();\n    });\n\n    it('should report sampling availability correctly', () => {\n      expect(server.isSamplingAvailable()).toBe(false);\n      \n      const mockHandler: SamplingHandler = vi.fn();\n      server.registerSampling({ createMessage: mockHandler });\n      \n      expect(server.isSamplingAvailable()).toBe(true);\n    });\n  });\n});