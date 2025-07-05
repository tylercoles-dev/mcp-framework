import { HttpTransport } from '../src/index';
import { MCPServer } from '@tylercoles/mcp-server';
import { AuthProvider, User } from '@tylercoles/mcp-auth';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';

// Create an array to store mock transport instances
const mockTransports: any[] = [];

// Mock dependencies
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation((config) => {
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
      handleRequest: jest.fn().mockImplementation(async (req, res, body) => {
        // Handle initialize request
        if (body?.method === 'initialize') {
          // Generate session ID
          transport._sessionId = config?.sessionIdGenerator ? config.sessionIdGenerator() : 'test-session-123';
          
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
          // For other requests, just send 202 Accepted
          res.status(202).send();
        }
      }),
      close: jest.fn()
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

// Helper to create mock auth provider
const createMockAuthProvider = (authenticateResult: User | null = null): AuthProvider => {
  const provider = {
    authenticate: jest.fn().mockResolvedValue(authenticateResult),
    getUser: jest.fn().mockReturnValue(authenticateResult)
  };
  return provider as unknown as AuthProvider;
};

describe('HttpTransport', () => {
  let transport: HttpTransport;
  let server: MCPServer;
  let app: express.Application;

  beforeEach(() => {
    // Clear mock transports array
    mockTransports.length = 0;
    // Create mock MCP server
    server = {
      getSDKServer: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined)
      })
    } as any;
  });

  afterEach(async () => {
    if (transport) {
      await transport.stop();
    }
  });

  describe('Basic Functionality', () => {
    it('should start with default configuration', async () => {
      transport = new HttpTransport({ port: 0 });
      await transport.start(server);
      
      expect(transport.getApp()).toBeDefined();
      expect(transport.getSessionCount()).toBe(0);
    });

    it('should start with custom port', async () => {
      transport = new HttpTransport({ port: 0 });
      await transport.start(server);
      
      const port = transport.getPort();
      expect(port).toBeDefined();
      expect(port).toBeGreaterThan(0);
    });

    it('should handle health check endpoint', async () => {
      transport = new HttpTransport({ port: 0 });
      await transport.start(server);
      app = transport.getApp()!;

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        transport: 'streamableHttp'
      });
    });
  });

  describe('Router Registration', () => {
    beforeEach(async () => {
      transport = new HttpTransport({ port: 0 });
      await transport.start(server);
      app = transport.getApp()!;
    });

    it('should register public router', async () => {
      const router = transport.createRouter(false);
      router.get('/test', (req, res) => res.json({ public: true }));
      
      transport.registerRouter('/api', router);
      
      // Test the route
      return request(app)
        .get('/api/test')
        .expect(200)
        .expect({ public: true });
    });

    it('should register authenticated router', async () => {
      const authProvider = createMockAuthProvider(null);
      transport = new HttpTransport({ 
        port: 0,
        auth: authProvider
      });
      await transport.start(server);
      app = transport.getApp()!;

      const router = transport.createRouter(true);
      router.get('/test', (req, res) => res.json({ authenticated: true }));
      
      transport.registerRouter('/api', router);
      
      // Test without auth should fail
      return request(app)
        .get('/api/test')
        .expect(401);
    });
  });

  describe('Authentication', () => {
    const testUser: User = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      groups: []
    };

    it('should apply auth middleware when configured', async () => {
      const authProvider = createMockAuthProvider(testUser);
      transport = new HttpTransport({ 
        port: 0,
        auth: authProvider
      });
      await transport.start(server);
      app = transport.getApp()!;

      const router = transport.createRouter(true);
      router.get('/user', (req, res) => {
        const user = transport.getAuthenticatedUser(req);
        res.json(user);
      });
      
      transport.registerRouter('/api', router);

      // Mock the auth provider to return our test user
      (authProvider.authenticate as jest.Mock).mockResolvedValue(testUser);

      const response = await request(app)
        .get('/api/user')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body).toEqual(testUser);
    });

    it('should reject requests without authentication', async () => {
      const authProvider = createMockAuthProvider(null);
      transport = new HttpTransport({
        port: 0,
        auth: authProvider
      });
      await transport.start(server);
      app = transport.getApp()!;

      const router = transport.createRouter(true);
      router.get('/protected', (req, res) => res.json({ protected: true }));
      
      transport.registerRouter('/api', router);

      await request(app)
        .get('/api/protected')
        .expect(401);
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      transport = new HttpTransport({ port: 0 });
      await transport.start(server);
      app = transport.getApp()!;
    });

    it('should handle MCP requests with sessions', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {}
          }
        })
        .expect(200);

      expect(response.headers['mcp-session-id']).toBeDefined();
      expect(transport.getSessionCount()).toBe(1);
    });

    it('should clean up sessions on close', async () => {
      // Create a session
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {}
          }
        });

      expect(transport.getSessionCount()).toBe(1);
      
      // Get the session ID from response
      const sessionId = response.headers['mcp-session-id'];
      expect(sessionId).toBeDefined();

      // Get the mock transport instance that was created
      const mockTransport = mockTransports[mockTransports.length - 1];
      
      // Ensure the transport has the correct session ID
      expect(mockTransport.sessionId).toBe(sessionId);
      
      // Trigger the onclose callback
      if (mockTransport.onclose) {
        mockTransport.onclose();
      }

      expect(transport.getSessionCount()).toBe(0);
    });
  });
});
