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

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: request.messages,
          maxTokens: 100,
          temperature: 0.7
        })
      );
    });

    it('should handle request with model preferences', async () => {
      const modelPreferences: ModelPreferences = {
        hints: ['be concise', 'use technical language'],
        costPriority: 0.3,
        speedPriority: 0.8,
        intelligencePriority: 0.9
      };

      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Explain quantum computing' }
        }],
        modelPreferences,
        systemPrompt: 'You are a helpful technical assistant.'
      };

      await server.createSamplingMessage(request);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          modelPreferences,
          systemPrompt: 'You are a helpful technical assistant.'
        })
      );\n    });\n\n    it('should handle multi-modal messages', async () => {
      const request: SamplingRequest = {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'What do you see in this image?'
            }
          },
          {
            role: 'user',
            content: {
              type: 'image',
              data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
              mimeType: 'image/png'
            }
          }
        ]
      };

      await server.createSamplingMessage(request);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: request.messages
        })
      );
    });\n\n    it('should add server context when includeContext is true', async () => {
      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Hello' }
        }],
        includeContext: true
      };

      await server.createSamplingMessage(request);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            serverContext: expect.objectContaining({
              name: 'test-server',
              version: '1.0.0',
              capabilities: expect.any(Object),
              timestamp: expect.any(String)
            })
          })
        })
      );
    });\n\n    it('should apply default temperature from server range', async () => {
      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Hello' }
        }]
        // No temperature specified
      };

      await server.createSamplingMessage(request);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 1.0 // (0.0 + 2.0) / 2
        })
      );
    });\n  });\n\n  describe('Request Validation', () => {\n    beforeEach(() => {\n      const mockHandler: SamplingHandler = vi.fn().mockResolvedValue({\n        role: 'assistant',\n        content: { type: 'text', text: 'Response' }\n      });\n\n      server.registerSampling({\n        createMessage: mockHandler,\n        maxTokensLimit: 1000,\n        temperatureRange: { min: 0.1, max: 1.8 }\n      });\n    });\n\n    it('should validate required messages array', async () => {
      const invalidRequests = [
        { messages: [] },
        { messages: undefined as any },
        { messages: 'not an array' as any }
      ];

      for (const request of invalidRequests) {
        await expect(server.createSamplingMessage(request as any)).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining('must include at least one message')
          })
        );
      }
    });\n\n    it('should validate message roles', async () => {
      const request: SamplingRequest = {
        messages: [{
          role: 'invalid' as any,
          content: { type: 'text', text: 'Hello' }
        }]
      };

      await expect(server.createSamplingMessage(request)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Invalid role at message 0')
        })
      );
    });\n\n    it('should validate message content types', async () => {
      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: {
            type: 'invalid' as any,
            text: 'Hello'
          }
        }]
      };

      await expect(server.createSamplingMessage(request)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Invalid content type at message 0')
        })
      );
    });\n\n    it('should validate text message content', async () => {
      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: {
            type: 'text'
            // Missing text field
          } as any
        }]
      };

      await expect(server.createSamplingMessage(request)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Text message at index 0 must have text content')
        })
      );
    });\n\n    it('should validate image message content', async () => {
      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: {
            type: 'image',
            data: 'base64data'
            // Missing mimeType
          } as any
        }]
      };

      await expect(server.createSamplingMessage(request)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Image message at index 0 must have data and mimeType')
        })
      );
    });\n\n    it('should validate model preferences ranges', async () => {
      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Hello' }
        }],
        modelPreferences: {
          costPriority: 1.5 // Invalid: > 1
        }
      };

      await expect(server.createSamplingMessage(request)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Cost priority must be between 0 and 1')
        })
      );
    });\n\n    it('should validate temperature against server limits', async () => {
      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Hello' }
        }],
        temperature: 2.0 // Outside server range of 0.1-1.8
      };

      await expect(server.createSamplingMessage(request)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Temperature must be between 0.1 and 1.8')
        })
      );
    });\n\n    it('should validate max tokens against server limits', async () => {
      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Hello' }
        }],
        maxTokens: 2000 // Exceeds server limit of 1000
      };

      await expect(server.createSamplingMessage(request)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Max tokens cannot exceed 1000')
        })
      );
    });\n  });\n\n  describe('Response Validation', () => {\n    it('should validate sampling response format', async () => {
      const invalidHandler: SamplingHandler = vi.fn().mockResolvedValue({
        role: 'user', // Invalid: should be 'assistant'
        content: { type: 'text', text: 'Response' }
      });

      server.registerSampling({ createMessage: invalidHandler });

      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Hello' }
        }]
      };

      await expect(server.createSamplingMessage(request)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Sampling response role must be assistant')
        })
      );
    });\n\n    it('should validate response content format', async () => {
      const invalidHandler: SamplingHandler = vi.fn().mockResolvedValue({
        role: 'assistant',
        content: {
          type: 'image', // Invalid: should be 'text'
          text: 'Response'
        } as any
      });

      server.registerSampling({ createMessage: invalidHandler });

      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Hello' }
        }]
      };

      await expect(server.createSamplingMessage(request)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Sampling response content must be text type')
        })
      );
    });\n\n    it('should validate usage statistics format', async () => {
      const invalidHandler: SamplingHandler = vi.fn().mockResolvedValue({
        role: 'assistant',
        content: { type: 'text', text: 'Response' },
        usage: {
          inputTokens: -10 // Invalid: negative
        }
      });

      server.registerSampling({ createMessage: invalidHandler });

      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Hello' }
        }]
      };

      await expect(server.createSamplingMessage(request)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Invalid input tokens count')
        })
      );
    });\n  });\n\n  describe('Error Handling', () => {\n    it('should handle sampling when not configured', async () => {
      // Don't register sampling
      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Hello' }
        }]
      };

      await expect(server.createSamplingMessage(request)).rejects.toThrow(
        MCPErrorFactory.invalidRequest('Sampling is not configured on this server')
      );
    });\n\n    it('should handle handler errors gracefully', async () => {
      const faultyHandler: SamplingHandler = vi.fn().mockRejectedValue(
        new Error('Model API error')
      );

      server.registerSampling({ createMessage: faultyHandler });

      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Hello' }
        }]
      };

      await expect(server.createSamplingMessage(request)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Sampling failed: Model API error')
        })
      );
    });\n\n    it('should handle unknown handler errors', async () => {
      const faultyHandler: SamplingHandler = vi.fn().mockRejectedValue(
        'Unknown error type'
      );

      server.registerSampling({ createMessage: faultyHandler });

      const request: SamplingRequest = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Hello' }
        }]
      };

      await expect(server.createSamplingMessage(request)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Sampling failed with unknown error')
        })
      );
    });\n  });\n\n  describe('Capabilities Integration', () => {\n    it('should include sampling in capabilities when configured', () => {\n      const mockHandler: SamplingHandler = vi.fn();\n      \n      server.registerSampling({\n        createMessage: mockHandler,\n        includeContext: true,\n        supportedModels: ['gpt-4']\n      });\n\n      const capabilities = server.getCapabilities();\n      \n      expect(capabilities.sampling).toBeDefined();\n      expect(capabilities.sampling?.includeContext).toBe(true);\n      expect(capabilities.sampling?.supportedModels).toEqual(['gpt-4']);\n    });\n\n    it('should not include sampling in capabilities when not configured', () => {\n      const capabilities = server.getCapabilities();\n      \n      expect(capabilities.sampling).toBeUndefined();\n    });\n\n    it('should report sampling availability correctly', () => {\n      expect(server.isSamplingAvailable()).toBe(false);\n      \n      const mockHandler: SamplingHandler = vi.fn();\n      server.registerSampling({ createMessage: mockHandler });\n      \n      expect(server.isSamplingAvailable()).toBe(true);\n    });\n  });\n});