import { AuthentikAuth } from '../src/index';
import { ClientRegistrationRequest } from '@tylercoles/mcp-auth';
import express, { Request, Response, Router } from 'express';
import request from 'supertest';
import nock from 'nock';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock passport to avoid actual OAuth flow
vi.mock('passport', () => {
  const passport = {
    use: vi.fn(),
    initialize: vi.fn(() => (req: any, res: any, next: any) => next()),
    session: vi.fn(() => (req: any, res: any, next: any) => next()),
    authenticate: vi.fn((strategy: string, options?: any) => {
      return (req: Request, res: Response, next: any) => {
        // Mock successful authentication
        if (req.path === '/auth/callback' && req.query.code) {
          req.user = {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
            groups: ['users', 'staff']
          };
          next();
        } else if (req.path === '/auth/login') {
          res.redirect('/auth/callback?code=test-code&state=test-state');
        } else {
          res.status(401).json({ error: 'Unauthorized' });
        }
      };
    }),
    serializeUser: vi.fn((cb: any) => {
      const user = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        groups: ['users', 'staff']
      };
      cb(user, (err: any, id: string) => id);
    }),
    deserializeUser: vi.fn((cb: any) => {
      const user = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        groups: ['users', 'staff']
      };
      cb('user-123', (err: any, user: any) => user);
    })
  };
  
  return {
    default: passport,
    ...passport
  };
});

vi.mock('express-session', () => ({
  default: vi.fn(() => (req: any, res: any, next: any) => {
    req.session = {
      regenerate: vi.fn((cb: any) => cb()),
      destroy: vi.fn((cb: any) => cb()),
      save: vi.fn((cb: any) => cb())
    };
    next();
  })
}));

describe('AuthentikAuth', () => {
  let auth: AuthentikAuth;
  let app: express.Application;
  let router: Router;

  beforeEach(() => {
    auth = new AuthentikAuth({
      url: 'https://auth.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret',
      redirectUri: 'http://localhost:3000/auth/callback',
      sessionSecret: 'test-session-secret'
    });

    app = express();
    router = express.Router();
    
    // Setup session middleware
    app.use(express.json());
    
    // Setup routes
    auth.setupRoutes(router);
    app.use(router);
  });

  beforeEach(() => {
    // Mock OAuth discovery endpoint
    nock('https://auth.example.com')
      .get('/application/o/test-client/.well-known/openid-configuration')
      .reply(200, {
        issuer: 'https://auth.example.com/application/o/test-client/',
        authorization_endpoint: 'https://auth.example.com/application/o/authorize/',
        token_endpoint: 'https://auth.example.com/application/o/token/',
        userinfo_endpoint: 'https://auth.example.com/application/o/userinfo/',
        jwks_uri: 'https://auth.example.com/application/o/test-client/jwks/',
        response_types_supported: ['code', 'id_token', 'id_token token', 'code token', 'code id_token', 'code id_token token'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
        scopes_supported: ['openid', 'profile', 'email', 'groups']
      })
      .persist();
  });

  afterEach(() => {
    nock.cleanAll();
    vi.clearAllMocks();
  });

  describe('Route Setup', () => {
    it('should setup authentication routes', async () => {
      const response = await request(app)
        .get('/auth/login')
        .expect(302);

      expect(response.headers.location).toContain('/auth/callback');
    });

    it('should handle callback route', async () => {
      const response = await request(app)
        .get('/auth/callback?code=test-code&state=test-state')
        .expect(302);

      expect(response.headers.location).toBe('/');
    });

    it('should setup user info route', async () => {
      // Create a new app with auth middleware first
      const testApp = express();
      testApp.use(express.json());
      
      // Add auth middleware before routes
      testApp.use((req: any, res, next) => {
        req.user = {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          groups: ['users']
        };
        req.isAuthenticated = () => true;
        next();
      });
      
      const testRouter = express.Router();
      auth.setupRoutes(testRouter);
      testApp.use(testRouter);

      const response = await request(testApp)
        .get('/auth/user')
        .expect(200);

      expect(response.body).toMatchObject({
        user: {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com'
        }
      });
    });

    it('should handle logout route', async () => {
      // Create a test app with logout mock
      const testApp = express();
      testApp.use(express.json());
      
      // Mock logout function
      testApp.use((req: any, res, next) => {
        req.logout = (cb: any) => {
          cb(null);
        };
        next();
      });
      
      const testRouter = express.Router();
      auth.setupRoutes(testRouter);
      testApp.use(testRouter);
      
      const response = await request(testApp)
        .post('/auth/logout')
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it('should return 503 when not initialized', async () => {
      // Create a new instance that we can control the initialization state
      const uninitializedAuth = new AuthentikAuth({
        url: 'https://auth.example.com',
        clientId: 'test-client',
        authorizationFlowId: 'test-flow',
        invalidationFlowId: 'test-invalidation',
        scopes: ['openid', 'profile', 'email'],
        redirectUri: 'http://localhost:3000/auth/callback',
        sessionSecret: 'test-secret'
      });
      
      // Mock the initialize method to prevent automatic initialization
      const originalInitialize = uninitializedAuth.initialize;
      uninitializedAuth.initialize = vi.fn().mockResolvedValue(undefined);
      
      // Set the initialized flag to false manually
      (uninitializedAuth as any).passportInitialized = false;
      
      const testApp = express();
      testApp.use(express.json());
      
      const testRouter = express.Router();
      uninitializedAuth.setupRoutes(testRouter);
      testApp.use(testRouter);
      
      const response = await request(testApp)
        .get('/auth/login')
        .expect(503);
      
      expect(response.body).toMatchObject({
        error: 'temporarily_unavailable',
        error_description: 'Authentication system initializing'
      });
      
      // Restore original method
      uninitializedAuth.initialize = originalInitialize;
    });
  });

  describe('Authentication Flow', () => {
    beforeEach(() => {
      // Mock Authentik discovery endpoint
      nock('https://auth.example.com')
        .get('/application/o/test-client/.well-known/openid-configuration')
        .reply(200, {
          issuer: 'https://auth.example.com',
          authorization_endpoint: 'https://auth.example.com/application/o/authorize/',
          token_endpoint: 'https://auth.example.com/application/o/token/',
          userinfo_endpoint: 'https://auth.example.com/application/o/userinfo/',
          jwks_uri: 'https://auth.example.com/application/o/test-client/jwks/',
          scopes_supported: ['openid', 'profile', 'email', 'groups'],
          response_types_supported: ['code', 'token', 'id_token'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          subject_types_supported: ['public']
        });
    });

    it('should authenticate user from request', async () => {
      const mockReq = {
        headers: {},
        user: {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          groups: ['users']
        },
        isAuthenticated: () => true
      } as any;

      const user = await auth.authenticate(mockReq);
      expect(user).toEqual({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        groups: ['users']
      });
    });

    it('should return null for unauthenticated request', async () => {
      const mockReq = {
        headers: {},
        isAuthenticated: () => false
      } as any;

      const user = await auth.authenticate(mockReq);
      expect(user).toBeNull();
    });

    it('should get user from request', () => {
      const mockReq = {
        headers: {},
        user: {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          groups: ['users']
        },
        isAuthenticated: () => true
      } as any;

      const user = auth.getUser(mockReq);
      expect(user).toEqual({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        groups: ['users']
      });
    });
  });

  describe('OAuth Endpoints', () => {
    it('should return discovery metadata', () => {
      const metadata = auth.getDiscoveryMetadata('https://mcp.example.com');
      
      expect(metadata).toMatchObject({
        issuer: 'https://auth.example.com/application/o/test-client/',
        authorization_endpoint: expect.stringContaining('https://auth.example.com'),
        token_endpoint: expect.stringContaining('https://auth.example.com'),
        scopes_supported: expect.arrayContaining(['openid', 'profile', 'email'])
      });
    });

    it('should return protected resource metadata', () => {
      const metadata = auth.getProtectedResourceMetadata('https://mcp.example.com');
      
      expect(metadata).toMatchObject({
        resource: 'https://mcp.example.com',
        authorization_servers: ['https://auth.example.com/application/o/test-client/']
      });
    });

    it('should generate authorization URL', async () => {
      const url = await auth.getAuthUrl('test-state', 'http://localhost:3000/callback');
        

      expect(url).toContain('https://auth.example.com');
      expect(url).toContain('client_id=test-client');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=test-state');
    });
  });

  describe('Token Management', () => {
    beforeEach(() => {
      // Mock token endpoint
      nock('https://auth.example.com')
        .post('/application/o/token/')
        .reply(200, {
          access_token: 'new-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new-refresh-token',
          scope: 'openid profile email groups'
        });
    });

    it('should handle authorization callback', async () => {
      const result = await auth.handleCallback('test-code', 'test-state', 'http://localhost:3000/callback');
      
      expect(result).toMatchObject({
        accessToken: 'new-access-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshToken: 'new-refresh-token'
      });
    });

    it('should refresh access token', async () => {
      const result = await auth.refreshToken('old-refresh-token');
      
      expect(result).toMatchObject({
        accessToken: 'new-access-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshToken: 'new-refresh-token'
      });
    });

    it('should handle token errors', async () => {
      nock.cleanAll();
      // Re-add discovery endpoint mock
      nock('https://auth.example.com')
        .get('/application/o/test-client/.well-known/openid-configuration')
        .reply(200, {
          issuer: 'https://auth.example.com/application/o/test-client/',
          authorization_endpoint: 'https://auth.example.com/application/o/authorize/',
          token_endpoint: 'https://auth.example.com/application/o/token/',
          userinfo_endpoint: 'https://auth.example.com/application/o/userinfo/',
          jwks_uri: 'https://auth.example.com/application/o/test-client/jwks/',
          response_types_supported: ['code', 'id_token', 'id_token token', 'code token', 'code id_token', 'code id_token token'],
          subject_types_supported: ['public'],
          id_token_signing_alg_values_supported: ['RS256'],
          token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
          scopes_supported: ['openid', 'profile', 'email', 'groups']
        });
      
      nock('https://auth.example.com')
        .post('/application/o/token/')
        .reply(400, {
          error: 'invalid_grant',
          error_description: 'Invalid refresh token'
        });

      await expect(
        auth.refreshToken('bad-refresh-token')
      ).rejects.toThrow('Token refresh failed: invalid_grant - Invalid refresh token');
    });
  });

  describe('Group Restrictions', () => {
    it('should pass through user from session regardless of groups', async () => {
      // Note: In real usage, group restrictions are enforced during the OAuth flow
      // when verifying tokens. For session-based auth, the user has already
      // been validated during login.
      const restrictedAuth = new AuthentikAuth({
        url: 'https://auth.example.com',
        clientId: 'test-client',
        allowedGroups: ['admin', 'staff']
      });

      const mockReq = {
        headers: {},
        user: {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          groups: ['users'] // Not in allowed groups
        },
        isAuthenticated: () => true
      } as any;

      const user = await restrictedAuth.authenticate(mockReq);
      expect(user).toEqual({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        groups: ['users']
      });
    });

    it('should allow users with required groups', async () => {
      const restrictedAuth = new AuthentikAuth({
        url: 'https://auth.example.com',
        clientId: 'test-client',
        allowedGroups: ['admin', 'staff']
      });

      const mockReq = {
        headers: {},
        user: {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          groups: ['users', 'staff'] // Has required group
        },
        isAuthenticated: () => true
      } as any;

      const user = await restrictedAuth.authenticate(mockReq);
      expect(user).toBeDefined();
      expect(user?.username).toBe('testuser');
    });
  });

  describe('Dynamic Client Registration', () => {
    let authWithToken: AuthentikAuth;

    beforeEach(() => {
      authWithToken = new AuthentikAuth({
        url: 'https://auth.example.com',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        registrationApiToken: 'test-api-token'
      });

      // Mock discovery endpoint
      nock('https://auth.example.com')
        .get('/application/o/test-client/.well-known/openid-configuration')
        .reply(200, {
          issuer: 'https://auth.example.com/application/o/test-client/',
          authorization_endpoint: 'https://auth.example.com/application/o/authorize/',
          token_endpoint: 'https://auth.example.com/application/o/token/',
          userinfo_endpoint: 'https://auth.example.com/application/o/userinfo/',
          jwks_uri: 'https://auth.example.com/application/o/test-client/jwks/',
          response_types_supported: ['code'],
          subject_types_supported: ['public'],
          id_token_signing_alg_values_supported: ['RS256'],
          token_endpoint_auth_methods_supported: ['client_secret_post'],
          scopes_supported: ['openid', 'profile', 'email']
        })
        .persist();
    });

    it('should register a new client via Authentik API', async () => {
      const timestamp = Date.now();
      const providerId = 123;
      const applicationId = 456;

      // Mock OAuth2 provider creation
      nock('https://auth.example.com')
        .post('/api/v3/providers/oauth2/')
        .reply(201, {
          pk: providerId,
          name: `mcp-testclient-${timestamp}`,
          client_id: `mcp-${timestamp}`,
          client_secret: 'generated-secret'
        });

      // Mock application creation
      nock('https://auth.example.com')
        .post('/api/v3/core/applications/')
        .reply(201, {
          pk: applicationId,
          name: 'MCP testclient',
          slug: `mcp-testclient-${timestamp}`
        });

      // Mock provider details fetch
      nock('https://auth.example.com')
        .get(`/api/v3/providers/oauth2/${providerId}/`)
        .reply(200, {
          pk: providerId,
          client_id: `mcp-${timestamp}`,
          client_secret: 'generated-secret'
        });

      const request: ClientRegistrationRequest = {
        client_name: 'testclient',
        redirect_uris: ['https://example.com/callback'],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        scope: 'openid profile email'
      };

      const response = await authWithToken.registerClient(request);

      expect(response).toMatchObject({
        client_id: `mcp-${timestamp}`,
        client_secret: 'generated-secret',
        redirect_uris: ['https://example.com/callback'],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        scope: 'openid profile email'
      });
    });

    it('should throw error when API token is missing', async () => {
      const authNoToken = new AuthentikAuth({
        url: 'https://auth.example.com',
        clientId: 'test-client'
      });

      const request: ClientRegistrationRequest = {
        client_name: 'testclient',
        redirect_uris: ['https://example.com/callback']
      };

      await expect(authNoToken.registerClient(request))
        .rejects.toThrow('Dynamic registration requires API token configuration');
    });

    it('should handle API errors during registration', async () => {
      nock('https://auth.example.com')
        .post('/api/v3/providers/oauth2/')
        .reply(401, { detail: 'Invalid token' });

      const request: ClientRegistrationRequest = {
        client_name: 'testclient',
        redirect_uris: ['https://example.com/callback']
      };

      await expect(authWithToken.registerClient(request))
        .rejects.toThrow('Client registration failed: Invalid or missing authentication token');
    });

    it('should validate API token', async () => {
      nock('https://auth.example.com')
        .get('/api/v3/providers/oauth2/?page_size=1')
        .reply(200, { results: [] });

      const isValid = await authWithToken.validateRegistrationToken();
      expect(isValid).toBe(true);
    });

    it('should fail token validation with invalid token', async () => {
      nock('https://auth.example.com')
        .get('/api/v3/providers/oauth2/?page_size=1')
        .reply(401, { detail: 'Invalid token' });

      const isValid = await authWithToken.validateRegistrationToken();
      expect(isValid).toBe(false);
    });

    it('should revoke a registered client', async () => {
      const providerId = 123;
      const applicationId = 456;
      const clientId = 'mcp-12345';

      // Mock finding the provider
      nock('https://auth.example.com')
        .get(`/api/v3/providers/oauth2/?client_id=${encodeURIComponent(clientId)}`)
        .reply(200, {
          results: [{
            pk: providerId,
            client_id: clientId,
            name: 'mcp-testclient-12345'
          }]
        });

      // Mock finding applications
      nock('https://auth.example.com')
        .get(`/api/v3/core/applications/?provider=${providerId}`)
        .reply(200, {
          results: [{
            pk: applicationId,
            name: 'MCP testclient'
          }]
        });

      // Mock deleting application
      nock('https://auth.example.com')
        .delete(`/api/v3/core/applications/${applicationId}/`)
        .reply(204);

      // Mock deleting provider
      nock('https://auth.example.com')
        .delete(`/api/v3/providers/oauth2/${providerId}/`)
        .reply(204);

      await expect(authWithToken.revokeRegistration(clientId))
        .resolves.toBeUndefined();
    });

    it('should handle revocation when client not found', async () => {
      const clientId = 'nonexistent-client';

      nock('https://auth.example.com')
        .get(`/api/v3/providers/oauth2/?client_id=${encodeURIComponent(clientId)}`)
        .reply(200, { results: [] });

      // Should not throw, just warn
      await expect(authWithToken.revokeRegistration(clientId))
        .resolves.toBeUndefined();
    });
  });
});
