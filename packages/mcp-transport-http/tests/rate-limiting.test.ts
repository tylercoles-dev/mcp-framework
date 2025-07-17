import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { HttpTransport, HttpConfig } from '../src/index.js';
import { MCPServer } from '@tylercoles/mcp-server';
import { z } from 'zod';

// Create an array to store mock transport instances
const mockTransports: any[] = [];

// Track initialize call count for unique session IDs
let initializeCount = 0;

// Mock dependencies - same as in http.test.ts
vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn((config) => {
    const transport = {
      _sessionId: null as string | null,
      get sessionId() {
        return this._sessionId;
      },
      set sessionId(value: string | null) {
        this._sessionId = value;
      },
      onclose: null,
      onsessioninitialized: null,
      handleRequest: vi.fn(async (req, res, body) => {
        // Handle initialize request
        if (body?.method === 'initialize') {
          // Generate unique session ID for each initialize call
          initializeCount++;
          transport._sessionId = config?.sessionIdGenerator ? config.sessionIdGenerator() : `test-session-${initializeCount}-${Date.now()}`;
          
          // Set the sessionId property so it's accessible
          transport.sessionId = transport._sessionId;
          
          // Call session initialized callback if provided
          if (config?.onsessioninitialized) {
            config.onsessioninitialized(transport._sessionId);
          }
          
          // Set session header and send response
          res.setHeader('mcp-session-id', transport._sessionId);
          res.status(200).json({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              protocolVersion: '2025-06-18',
              capabilities: {},
              serverInfo: {
                name: 'test-server',
                version: '1.0.0'
              }
            }
          });
        } else {
          // For other requests (like tools/call), send 200 OK with mock response
          res.status(200).json({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{ type: 'text', text: `Mock response for ${body.method}` }]
            }
          });
        }
      }),
      close: vi.fn()
    };
    
    // Store onclose callback from config
    if (config?.onclose) {
      transport.onclose = config.onclose;
    }
    
    // Store the transport instance for test access
    mockTransports.push(transport);
    
    return transport;
  })
}));

describe('HTTP Transport Rate Limiting', () => {
  let transport: HttpTransport;
  let server: MCPServer;

  beforeEach(() => {
    // Clear mock transports array and reset counter
    mockTransports.length = 0;
    initializeCount = 0;
    
    // Create mock MCP server
    server = {
      getSDKServer: vi.fn().mockReturnValue({
        connect: vi.fn().mockResolvedValue(undefined)
      })
    } as any;
  });

  afterEach(async () => {
    if (transport) {
      await transport.stop();
    }
  });

  it('should apply global rate limiting', async () => {
    const config: HttpConfig = {
      port: 0, // Use any available port
      rateLimit: {
        global: {
          windowMs: 60000,
          maxRequests: 2
        },
        headers: {
          includeHeaders: true
        }
      }
    };

    transport = new HttpTransport(config);
    await transport.start(server);

    const app = (transport as any).app;

    // Initialize MCP connection first
    const initResponse = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      });

    const sessionId = initResponse.headers['mcp-session-id'];

    // First request should succeed
    const response1 = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('mcp-session-id', sessionId)
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'test-tool',
          arguments: { message: 'test1' }
        }
      });

    expect(response1.status).toBe(200);
    expect(response1.headers['x-ratelimit-remaining']).toBe('1');  // Only tools/call counts, initialize excluded
    expect(response1.headers['x-ratelimit-limit']).toBe('2');

    // Second request should be rate limited (already at limit)
    const response2 = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('mcp-session-id', sessionId)
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'test-tool',
          arguments: { message: 'test2' }
        }
      });

    expect(response2.status).toBe(200);  // Should succeed (2nd tools/call out of 2 allowed)
    expect(response2.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('should apply per-client rate limiting based on session', async () => {
    const config: HttpConfig = {
      port: 0,
      rateLimit: {
        perClient: {
          windowMs: 60000,
          maxRequests: 1
        }
      }
    };

    transport = new HttpTransport(config);
    await transport.start(server);

    const app = (transport as any).app;

    // Initialize first session
    const init1 = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 'init1',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });
    const session1 = init1.headers['mcp-session-id'];

    // First request with session-1
    const response1 = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('mcp-session-id', session1)
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'test-tool',
          arguments: { message: 'test1' }
        }
      });

    expect(response1.status).toBe(200);

    // Second request with same session should be rate limited
    const response2 = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('mcp-session-id', session1)
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'test-tool',
          arguments: { message: 'test2' }
        }
      });

    expect(response2.status).toBe(429);

    // Initialize second session
    const init2 = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 'init2',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });
    const session2 = init2.headers['mcp-session-id'];

    // Request with different session should succeed
    const response3 = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('mcp-session-id', session2)
      .send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'test-tool',
          arguments: { message: 'test3' }
        }
      });

    expect(response3.status).toBe(200);
  });

  it('should use custom rate limit headers', async () => {
    const config: HttpConfig = {
      port: 0,
      rateLimit: {
        global: {
          windowMs: 60000,
          maxRequests: 2  // Allow for initialize + tools/call
        },
        headers: {
          includeHeaders: true,
          headerNames: {
            remaining: 'X-Custom-Remaining',
            limit: 'X-Custom-Limit',
            reset: 'X-Custom-Reset'
          }
        }
      }
    };

    transport = new HttpTransport(config);
    await transport.start(server);

    const app = (transport as any).app;

    // Initialize session
    const initResponse = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });
    const sessionId = initResponse.headers['mcp-session-id'];

    const response = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('mcp-session-id', sessionId)
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'test-tool',
          arguments: { message: 'test' }
        }
      });

    expect(response.status).toBe(200);
    expect(response.headers['x-custom-remaining']).toBe('1');  // Only tools/call counts, initialize excluded
    expect(response.headers['x-custom-limit']).toBe('2');
    expect(response.headers['x-custom-reset']).toBeDefined();
  });

  it('should handle custom onLimitReached callback', async () => {
    const customHandler = vi.fn((req, res, result) => {
      res.status(503).json({
        error: 'Custom rate limit message',
        retryAfter: result.retryAfter
      });
    });

    const config: HttpConfig = {
      port: 0,
      rateLimit: {
        global: {
          windowMs: 60000,
          maxRequests: 1
        },
        onLimitReached: customHandler
      }
    };

    transport = new HttpTransport(config);
    await transport.start(server);

    const app = (transport as any).app;

    // First request succeeds
    await request(app)
      .post('/mcp')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'test-tool',
          arguments: { message: 'test1' }
        }
      });

    // Second request triggers custom handler
    const response = await request(app)
      .post('/mcp')
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'test-tool',
          arguments: { message: 'test2' }
        }
      });

    expect(response.status).toBe(503);
    expect(response.body.error).toBe('Custom rate limit message');
    expect(customHandler).toHaveBeenCalledOnce();
  });

  it('should handle rate limiting with no configuration', async () => {
    const config: HttpConfig = {
      port: 0
      // No rate limiting configuration
    };

    transport = new HttpTransport(config);
    await transport.start(server);

    const app = (transport as any).app;

    // Initialize session
    const initResponse = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });
    const sessionId = initResponse.headers['mcp-session-id'];

    // Multiple requests should all succeed
    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('mcp-session-id', sessionId)
        .send({
          jsonrpc: '2.0',
          id: i,
          method: 'tools/call',
          params: {
            name: 'test-tool',
            arguments: { message: `test${i}` }
          }
        });

      expect(response.status).toBe(200);
    }
  });

  it('should apply IP-based rate limiting when no session provided', async () => {
    const config: HttpConfig = {
      port: 0,
      rateLimit: {
        perClient: {
          windowMs: 60000,
          maxRequests: 1
        }
      }
    };

    transport = new HttpTransport(config);
    await transport.start(server);

    const app = (transport as any).app;

    // Initialize session
    const initResponse = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });
    const sessionId = initResponse.headers['mcp-session-id'];

    // First request should succeed
    const response1 = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('mcp-session-id', sessionId)
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'test-tool',
          arguments: { message: 'test1' }
        }
      });

    expect(response1.status).toBe(200);

    // Second request from same IP should be rate limited
    const response2 = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('mcp-session-id', sessionId)
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'test-tool',
          arguments: { message: 'test2' }
        }
      });

    expect(response2.status).toBe(429);
  });

  it('should properly cleanup rate limiting resources on stop', async () => {
    const config: HttpConfig = {
      port: 0,
      rateLimit: {
        global: {
          windowMs: 60000,
          maxRequests: 5
        }
      }
    };

    transport = new HttpTransport(config);
    await transport.start(server);

    // Verify rate limiting middleware is initialized
    expect((transport as any).rateLimitMiddleware).toBeDefined();

    await transport.stop();

    // Verify cleanup was called
    expect((transport as any).rateLimitMiddleware).toBeNull();
  });

  it('should handle rate limiting errors gracefully with skipOnError', async () => {
    const faultyStore = {
      check: vi.fn().mockRejectedValue(new Error('Store error')),
      reset: vi.fn(),
      getStats: vi.fn(),
      cleanup: vi.fn()
    };

    const config: HttpConfig = {
      port: 0,
      rateLimit: {
        global: {
          windowMs: 60000,
          maxRequests: 1
        },
        skipOnError: true,
        store: faultyStore
      }
    };

    transport = new HttpTransport(config);
    await transport.start(server);

    const app = (transport as any).app;

    // Initialize session
    const initResponse = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });
    const sessionId = initResponse.headers['mcp-session-id'];

    // Request should succeed despite store error
    const response = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('mcp-session-id', sessionId)
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'test-tool',
          arguments: { message: 'test' }
        }
      });

    expect(response.status).toBe(200);
    expect(faultyStore.check).toHaveBeenCalled();
  });
});