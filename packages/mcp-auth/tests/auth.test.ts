import { Request } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AuthProvider,
  NoAuth,
  DevAuth,
  BearerTokenAuth,
  SessionAuth,
  OAuthProvider,
  User
} from '../src/index';

describe('Auth Providers', () => {
  let mockRequest: Request;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      session: {},
      user: undefined,
      isAuthenticated: vi.fn(() => false)
    } as any;
  });

  describe('NoAuth', () => {
    let provider: NoAuth;

    beforeEach(() => {
      provider = new NoAuth();
    });

    it('should always return null for authenticate', async () => {
      const user = await provider.authenticate(mockRequest);
      expect(user).toBeNull();
    });

    it('should always return null for getUser', () => {
      const user = provider.getUser(mockRequest);
      expect(user).toBeNull();
    });

    it('should be instance of AuthProvider', () => {
      expect(provider).toBeInstanceOf(AuthProvider);
    });
  });

  describe('DevAuth', () => {
    let provider: DevAuth;

    beforeEach(() => {
      provider = new DevAuth({
        id: 'custom-dev-id',
        username: 'custom-dev',
        email: 'custom@dev.com'
      });
    });

    it('should return mock user for authenticate', async () => {
      const user = await provider.authenticate(mockRequest);
      expect(user).toEqual({
        id: 'custom-dev-id',
        username: 'custom-dev',
        email: 'custom@dev.com',
        groups: ['developers']
      });
    });

    it('should return mock user for getUser', () => {
      const user = provider.getUser(mockRequest);
      expect(user).toEqual({
        id: 'custom-dev-id',
        username: 'custom-dev',
        email: 'custom@dev.com',
        groups: ['developers']
      });
    });

    it('should use default values when no user provided', () => {
      const defaultProvider = new DevAuth();
      const user = defaultProvider.getUser(mockRequest);
      expect(user).toEqual({
        id: 'dev-user-123',
        username: 'developer',
        email: 'dev@example.com',
        groups: ['developers']
      });
    });
  });

  describe('BearerTokenAuth', () => {
    // BearerTokenAuth is abstract, so we need to test a concrete implementation
    class TestBearerAuth extends BearerTokenAuth {
      constructor(private validTokens: Record<string, User>) {
        super();
      }

      async verifyToken(token: string): Promise<User | null> {
        return this.validTokens[token] || null;
      }
    }

    let provider: TestBearerAuth;
    const testUser: User = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      groups: ['users']
    };

    beforeEach(() => {
      provider = new TestBearerAuth({
        'valid-token': testUser
      });
    });

    it('should authenticate with valid bearer token', async () => {
      mockRequest.headers.authorization = 'Bearer valid-token';
      const user = await provider.authenticate(mockRequest);
      expect(user).toEqual(testUser);
    });

    it('should return null for invalid token', async () => {
      mockRequest.headers.authorization = 'Bearer invalid-token';
      const user = await provider.authenticate(mockRequest);
      expect(user).toBeNull();
    });

    it('should return null for missing authorization header', async () => {
      const user = await provider.authenticate(mockRequest);
      expect(user).toBeNull();
    });

    it('should return null for non-bearer auth', async () => {
      mockRequest.headers.authorization = 'Basic dXNlcjpwYXNz';
      const user = await provider.authenticate(mockRequest);
      expect(user).toBeNull();
    });

    it('should parse bearer token from authorization header', async () => {
      mockRequest.headers.authorization = 'Bearer test-token-123';
      // The token extraction happens internally in authenticate
      // We verify it by checking that verifyToken is called with the correct token
      const mockVerifyToken = vi.spyOn(provider as any, 'verifyToken');
      await provider.authenticate(mockRequest);
      expect(mockVerifyToken).toHaveBeenCalledWith('test-token-123');
    });

    it('should return null from getUser for bearer auth', () => {
      mockRequest.headers.authorization = 'Bearer valid-token';
      // getUser is synchronous and always returns null for BearerTokenAuth
      // Authentication must be done via the async authenticate method
      const user = provider.getUser(mockRequest);
      expect(user).toBeNull();
    });
  });

  describe('SessionAuth', () => {
    // SessionAuth is abstract, so we need to test a concrete implementation
    class TestSessionAuth extends SessionAuth {
      constructor(private getUserFromSession: (session: any) => User | null) {
        super();
      }

      async authenticate(req: Request): Promise<User | null> {
        return this.getUserFromSession(req.session);
      }

      getUser(req: Request): User | null {
        return this.getUserFromSession(req.session);
      }
    }

    let provider: TestSessionAuth;
    const testUser: User = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      groups: ['users']
    };

    beforeEach(() => {
      provider = new TestSessionAuth((session) => {
        return session?.userId ? testUser : null;
      });
    });

    it('should authenticate with valid session', async () => {
      (mockRequest.session as any).userId = 'user-123';
      const user = await provider.authenticate(mockRequest);
      expect(user).toEqual(testUser);
    });

    it('should return null for missing session data', async () => {
      (mockRequest.session as any).userId = undefined;
      const user = await provider.authenticate(mockRequest);
      expect(user).toBeNull();
    });

    it('should get user from session', () => {
      (mockRequest.session as any).userId = 'user-123';
      const user = provider.getUser(mockRequest);
      expect(user).toEqual(testUser);
    });
  });

  describe('OAuthProvider', () => {
    // OAuthProvider is abstract, so we test a concrete implementation
    class TestOAuthProvider extends OAuthProvider {
      async authenticate(req: Request): Promise<User | null> {
        // In OAuth, the user is typically set by passport middleware
        return req.user as User || null;
      }
      
      getUser(req: Request): User | null {
        return req.user as User || null;
      }

      getDiscoveryMetadata(baseUrl: string) {
        return {
          issuer: 'https://auth.test.com',
          authorization_endpoint: 'https://auth.test.com/authorize',
          token_endpoint: 'https://auth.test.com/token',
          userinfo_endpoint: 'https://auth.test.com/userinfo',
          scopes_supported: ['openid', 'profile', 'email'],
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code'],
          subject_types_supported: ['public']
        };
      }

      getAuthUrl(state?: string, redirectUri?: string): string {
        return `https://auth.test.com/authorize?client_id=test-client&state=${state}&redirect_uri=${redirectUri}`;
      }

      getProtectedResourceMetadata(baseUrl: string) {
        return {
          resource: baseUrl,
          authorization_servers: ['https://auth.test.com'],
          bearer_methods_supported: ['header'],
          resource_documentation: 'https://auth.test.com/docs'
        };
      }

      async handleCallback(code: string, state?: string, redirectUri?: string) {
        return {
          accessToken: 'test-access-token',
          tokenType: 'Bearer',
          expiresIn: 3600
        };
      }

      async verifyToken(token: string): Promise<User | null> {
        return token === 'valid-token' ? {
          id: 'oauth-user',
          username: 'oauthuser',
          email: 'oauth@example.com',
          groups: []
        } : null;
      }
    }

    let provider: TestOAuthProvider;

    beforeEach(() => {
      provider = new TestOAuthProvider();
    });

    it('should authenticate from request user', async () => {
      const testUser: User = {
        id: 'oauth-123',
        username: 'oauthuser',
        email: 'oauth@example.com',
        groups: ['oauth-users']
      };
      
      mockRequest.user = testUser;
      const user = await provider.authenticate(mockRequest);
      expect(user).toEqual(testUser);
    });

    it('should return discovery metadata', () => {
      const metadata = provider.getDiscoveryMetadata('https://example.com');
      expect(metadata).toMatchObject({
        issuer: 'https://auth.test.com',
        authorization_endpoint: expect.any(String),
        token_endpoint: expect.any(String),
        scopes_supported: expect.arrayContaining(['openid'])
      });
    });

    it('should generate authorization URL', async () => {
      const url = await provider.getAuthUrl('test-state', 'https://example.com/callback');
      expect(url).toContain('client_id=test-client');
      expect(url).toContain('state=test-state');
    });

    it('should handle callback', async () => {
      const result = await provider.handleCallback('test-code', 'test-state');
      expect(result).toMatchObject({
        accessToken: 'test-access-token',
        tokenType: 'Bearer'
      });
    });
  });

  describe('AuthProvider Base Class', () => {
    class TestAuthProvider extends AuthProvider {
      async authenticate(req: Request): Promise<User | null> {
        return { id: '1', username: 'test', email: 'test@example.com', groups: [] };
      }
      
      getUser(req: Request): User | null {
        return { id: '1', username: 'test', email: 'test@example.com', groups: [] };
      }
    }

    it('should be abstract class with required methods', () => {
      const provider = new TestAuthProvider();
      expect(provider.authenticate).toBeDefined();
      expect(provider.getUser).toBeDefined();
    });

    it('should have optional lifecycle methods', () => {
      const provider = new TestAuthProvider();
      expect(provider.initialize).toBeUndefined();
      expect(provider.shutdown).toBeUndefined();
    });
  });
});
