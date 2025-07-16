import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { AuthentikAuth } from '../src/index';
import { PKCEParams } from '@tylercoles/mcp-auth';

describe('AuthentikAuth - OAuth Compliance Tests', () => {
  let auth: AuthentikAuth;

  beforeEach(() => {
    auth = new AuthentikAuth({
      url: 'https://auth.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret',
      redirectUri: 'https://mcp.example.com/callback',
      applicationSlug: 'test-app'
    });

    // Mock OAuth discovery endpoint
    nock('https://auth.example.com')
      .get('/application/o/test-app/.well-known/openid-configuration')
      .reply(200, {
        issuer: 'https://auth.example.com/application/o/test-app/',
        authorization_endpoint: 'https://auth.example.com/application/o/authorize/',
        token_endpoint: 'https://auth.example.com/application/o/token/',
        userinfo_endpoint: 'https://auth.example.com/application/o/userinfo/',
        jwks_uri: 'https://auth.example.com/application/o/test-app/jwks/',
        scopes_supported: ['openid', 'profile', 'email'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        subject_types_supported: ['public'],
        code_challenge_methods_supported: ['S256', 'plain']
      })
      .persist();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('PKCE Compliance (OAuth 2.1)', () => {
    it('should include PKCE parameters in authorization URL', async () => {
      const pkceParams: PKCEParams = {
        codeVerifier: 'test-code-verifier-1234567890',
        codeChallenge: 'test-code-challenge-abcdef',
        codeChallengeMethod: 'S256'
      };

      const authUrl = await auth.getAuthUrl(
        'test-state',
        'https://mcp.example.com/callback',
        'https://mcp.example.com',
        pkceParams
      );

      expect(authUrl).toContain('code_challenge=test-code-challenge-abcdef');
      expect(authUrl).toContain('code_challenge_method=S256');
    });

    it('should include PKCE code verifier in token exchange', async () => {
      nock('https://auth.example.com')
        .post('/application/o/token/')
        .reply(200, (uri, requestBody) => {
          const body = requestBody as string;
          
          // Verify PKCE code verifier is included
          expect(body).toContain('code_verifier=test-code-verifier-1234567890');
          
          return {
            access_token: 'test-access-token',
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: 'test-refresh-token'
          };
        });

      const result = await auth.handleCallback(
        'test-auth-code',
        'test-state',
        'https://mcp.example.com/callback',
        'https://mcp.example.com',
        'test-code-verifier-1234567890'
      );

      expect(result.accessToken).toBe('test-access-token');
    });

    it('should advertise PKCE support in discovery metadata', () => {
      const metadata = auth.getDiscoveryMetadata('https://mcp.example.com');
      expect(metadata.code_challenge_methods_supported).toContain('S256');
    });
  });

  describe('Resource Parameter Compliance (RFC 8707)', () => {
    it('should include resource parameter in authorization URL', async () => {
      const resource = 'https://mcp.example.com';
      const authUrl = await auth.getAuthUrl(
        'test-state',
        'https://mcp.example.com/callback',
        resource
      );

      expect(authUrl).toContain(`resource=${encodeURIComponent(resource)}`);
    });

    it('should include resource parameter in token exchange', async () => {
      nock('https://auth.example.com')
        .post('/application/o/token/')
        .reply(200, (uri, requestBody) => {
          const body = requestBody as string;
          
          // Verify resource parameter is included
          expect(body).toContain('resource=https%3A%2F%2Fmcp.example.com');
          
          return {
            access_token: 'test-access-token',
            token_type: 'Bearer',
            expires_in: 3600
          };
        });

      await auth.handleCallback(
        'test-auth-code',
        'test-state',
        'https://mcp.example.com/callback',
        'https://mcp.example.com'
      );
    });

    it('should validate resource URI format', async () => {
      // Valid resource URI should work
      await expect(auth.getAuthUrl(
        'test-state',
        'https://mcp.example.com/callback',
        'https://mcp.example.com'
      )).resolves.not.toThrow();

      // Invalid resource URI should throw
      await expect(auth.getAuthUrl(
        'test-state',
        'https://mcp.example.com/callback',
        'http://remote.com' // HTTP not allowed for remote
      )).rejects.toThrow('Invalid resource URI format');
    });
  });

  describe('Token Audience Validation', () => {
    it('should validate token audience correctly', async () => {
      // Mock a JWT token with correct audience
      const mockJwtToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.' +
        btoa(JSON.stringify({
          sub: 'user-123',
          aud: 'https://mcp.example.com',
          exp: Math.floor(Date.now() / 1000) + 3600
        })) + '.signature';

      nock('https://auth.example.com')
        .get('/application/o/userinfo/')
        .reply(200, {
          sub: 'user-123',
          email: 'test@example.com',
          preferred_username: 'testuser',
          groups: ['users']
        });

      const user = await auth.verifyToken(mockJwtToken, 'https://mcp.example.com');
      expect(user).not.toBeNull();
      expect(user?.id).toBe('user-123');
    });

    it('should reject token with wrong audience', async () => {
      // Mock a JWT token with wrong audience
      const mockJwtToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.' +
        btoa(JSON.stringify({
          sub: 'user-123',
          aud: 'https://wrong.example.com',
          exp: Math.floor(Date.now() / 1000) + 3600
        })) + '.signature';

      const user = await auth.verifyToken(mockJwtToken, 'https://mcp.example.com');
      expect(user).toBeNull();
    });

    it('should handle multiple audiences in token', async () => {
      // Mock a JWT token with multiple audiences
      const mockJwtToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.' +
        btoa(JSON.stringify({
          sub: 'user-123',
          aud: ['https://api.example.com', 'https://mcp.example.com'],
          exp: Math.floor(Date.now() / 1000) + 3600
        })) + '.signature';

      nock('https://auth.example.com')
        .get('/application/o/userinfo/')
        .reply(200, {
          sub: 'user-123',
          email: 'test@example.com',
          preferred_username: 'testuser',
          groups: ['users']
        });

      const user = await auth.verifyToken(mockJwtToken, 'https://mcp.example.com');
      expect(user).not.toBeNull();
    });

    it('should reject token without audience when validation required', async () => {
      // Mock a JWT token without audience
      const mockJwtToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.' +
        btoa(JSON.stringify({
          sub: 'user-123',
          exp: Math.floor(Date.now() / 1000) + 3600
        })) + '.signature';

      const user = await auth.verifyToken(mockJwtToken, 'https://mcp.example.com');
      expect(user).toBeNull();
    });
  });

  describe('HTTPS Enforcement (OAuth 2.1)', () => {
    it('should reject non-HTTPS authorization endpoint', async () => {
      nock.cleanAll();
      nock('https://auth.example.com')
        .get('/application/o/test-app/.well-known/openid-configuration')
        .reply(200, {
          authorization_endpoint: 'http://auth.example.com/authorize', // HTTP not allowed
          token_endpoint: 'https://auth.example.com/token',
          userinfo_endpoint: 'https://auth.example.com/userinfo'
        });

      await expect(auth.getAuthUrl()).rejects.toThrow('Authorization endpoint must use HTTPS in production');
    });

    it('should reject non-HTTPS token endpoint', async () => {
      nock.cleanAll();
      nock('https://auth.example.com')
        .get('/application/o/test-app/.well-known/openid-configuration')
        .reply(200, {
          authorization_endpoint: 'https://auth.example.com/authorize',
          token_endpoint: 'http://auth.example.com/token', // HTTP not allowed
          userinfo_endpoint: 'https://auth.example.com/userinfo'
        });

      await expect(auth.handleCallback('code')).rejects.toThrow('Token endpoint must use HTTPS in production');
    });

    it('should reject non-HTTPS userinfo endpoint', async () => {
      nock.cleanAll();
      nock('https://auth.example.com')
        .get('/application/o/test-app/.well-known/openid-configuration')
        .reply(200, {
          authorization_endpoint: 'https://auth.example.com/authorize',
          token_endpoint: 'https://auth.example.com/token',
          userinfo_endpoint: 'http://auth.example.com/userinfo' // HTTP not allowed
        });

      await expect(auth.verifyToken('token')).rejects.toThrow('Userinfo endpoint must use HTTPS in production');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JWT tokens gracefully', async () => {
      const malformedTokens = [
        'not.a.jwt',
        'invalid-jwt-format',
        'too.few.parts',
        'too.many.parts.here.error',
        ''
      ];

      for (const token of malformedTokens) {
        const user = await auth.verifyToken(token, 'https://mcp.example.com');
        expect(user).toBeNull();
      }
    });

    it('should handle OAuth discovery failures', async () => {
      nock.cleanAll();
      nock('https://auth.example.com')
        .get('/application/o/test-app/.well-known/openid-configuration')
        .reply(500, 'Internal Server Error');

      await expect(auth.getAuthUrl()).rejects.toThrow('Failed to fetch OAuth configuration from Authentik');
    });

    it('should handle token exchange failures with proper error codes', async () => {
      nock('https://auth.example.com')
        .post('/application/o/token/')
        .reply(400, {
          error: 'invalid_grant',
          error_description: 'Invalid authorization code'
        });

      await expect(auth.handleCallback('invalid-code')).rejects.toThrow('OAuth error: invalid_grant - Invalid authorization code');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full OAuth flow with all compliance features', async () => {
      // Step 1: Generate PKCE parameters
      const pkceParams = (auth as any).generatePKCEParams();

      // Step 2: Get authorization URL with all compliance features
      const authUrl = await auth.getAuthUrl(
        'test-state',
        'https://mcp.example.com/callback',
        'https://mcp.example.com',
        pkceParams
      );

      expect(authUrl).toContain('code_challenge=');
      expect(authUrl).toContain('resource=');
      expect(authUrl).toContain('state=test-state');

      // Step 3: Mock successful token exchange
      nock('https://auth.example.com')
        .post('/application/o/token/')
        .reply(200, {
          access_token: 'access-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'refresh-token-123'
        });

      const tokenResult = await auth.handleCallback(
        'auth-code-123',
        'test-state',
        'https://mcp.example.com/callback',
        'https://mcp.example.com',
        pkceParams.codeVerifier
      );

      expect(tokenResult.accessToken).toBe('access-token-123');

      // Step 4: Verify token with audience validation
      const mockJwtToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.' +
        btoa(JSON.stringify({
          sub: 'user-123',
          aud: 'https://mcp.example.com',
          exp: Math.floor(Date.now() / 1000) + 3600
        })) + '.signature';

      nock('https://auth.example.com')
        .get('/application/o/userinfo/')
        .reply(200, {
          sub: 'user-123',
          email: 'test@example.com',
          preferred_username: 'testuser',
          groups: ['users']
        });

      const user = await auth.verifyToken(mockJwtToken, 'https://mcp.example.com');
      expect(user).not.toBeNull();
      expect(user?.id).toBe('user-123');
    });
  });
});
