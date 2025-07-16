import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { 
  OAuthProvider, 
  PKCEParams, 
  TokenResult, 
  OAuthDiscovery, 
  ProtectedResourceMetadata,
  User 
} from '../src/index';

// Test OAuth provider implementation
class TestOAuthProvider extends OAuthProvider {
  async authenticate(req: any): Promise<User | null> {
    return null;
  }
  
  getUser(req: any): User | null {
    return null;
  }

  async getAuthUrl(
    state?: string, 
    redirectUri?: string, 
    resource?: string, 
    pkceParams?: PKCEParams
  ): Promise<string> {
    const params = new URLSearchParams({
      client_id: 'test-client',
      response_type: 'code',
      redirect_uri: redirectUri || 'http://localhost:3000/callback'
    });

    if (state) params.set('state', state);
    if (resource) params.set('resource', resource);
    if (pkceParams) {
      params.set('code_challenge', pkceParams.codeChallenge);
      params.set('code_challenge_method', pkceParams.codeChallengeMethod);
    }

    return `https://auth.example.com/authorize?${params.toString()}`;
  }

  async handleCallback(
    code: string, 
    state?: string, 
    redirectUri?: string, 
    resource?: string,
    codeVerifier?: string
  ): Promise<TokenResult> {
    return {
      accessToken: 'test-access-token',
      tokenType: 'Bearer',
      expiresIn: 3600
    };
  }

  async verifyToken(token: string, expectedAudience?: string): Promise<User | null> {
    // Mock JWT token for testing
    if (token === 'valid-token-with-audience') {
      // Simulate a token with correct audience
      if (expectedAudience === 'https://example.com') {
        return { id: '1', username: 'test', email: 'test@example.com', groups: [] };
      }
      return null; // Wrong audience
    }
    
    if (token === 'valid-token-no-audience') {
      return { id: '1', username: 'test', email: 'test@example.com', groups: [] };
    }
    
    return null; // Invalid token
  }

  getDiscoveryMetadata(baseUrl: string): OAuthDiscovery {
    return {
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
      userinfo_endpoint: 'https://auth.example.com/userinfo',
      scopes_supported: ['openid', 'profile', 'email'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      code_challenge_methods_supported: ['S256', 'plain']
    };
  }

  getProtectedResourceMetadata(baseUrl: string): ProtectedResourceMetadata {
    return {
      resource: baseUrl,
      authorization_servers: ['https://auth.example.com']
    };
  }
}

describe('OAuth Provider - Security Compliance Tests', () => {
  let provider: TestOAuthProvider;

  beforeEach(() => {
    provider = new TestOAuthProvider();
  });

  describe('PKCE Implementation (OAuth 2.1 Requirement)', () => {
    it('should generate valid code verifier', () => {
      const codeVerifier = (provider as any).generateCodeVerifier();
      
      // Should be base64url encoded string
      expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
      
      // Should be 43-128 characters (RFC 7636)
      expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(codeVerifier.length).toBeLessThanOrEqual(128);
      
      // Should not contain padding
      expect(codeVerifier).not.toMatch(/=/);
    });

    it('should generate valid code challenge from verifier', () => {
      const codeVerifier = (provider as any).generateCodeVerifier();
      const codeChallenge = (provider as any).generateCodeChallenge(codeVerifier);
      
      // Should be base64url encoded SHA256 hash
      expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(codeChallenge.length).toBe(43); // SHA256 -> base64url = 43 chars
      expect(codeChallenge).not.toMatch(/=/);
      
      // Should be deterministic for same verifier
      const challenge2 = (provider as any).generateCodeChallenge(codeVerifier);
      expect(codeChallenge).toBe(challenge2);
    });

    it('should generate complete PKCE parameters', () => {
      const pkceParams = (provider as any).generatePKCEParams();
      
      expect(pkceParams).toHaveProperty('codeVerifier');
      expect(pkceParams).toHaveProperty('codeChallenge');
      expect(pkceParams).toHaveProperty('codeChallengeMethod');
      
      expect(pkceParams.codeChallengeMethod).toBe('S256');
      expect(pkceParams.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pkceParams.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should include PKCE parameters in authorization URL', async () => {
      const pkceParams = (provider as any).generatePKCEParams();
      const authUrl = await provider.getAuthUrl('test-state', 'http://localhost:3000/callback', undefined, pkceParams);
      
      expect(authUrl).toContain(`code_challenge=${pkceParams.codeChallenge}`);
      expect(authUrl).toContain('code_challenge_method=S256');
    });

    it('should advertise PKCE support in discovery metadata', () => {
      const metadata = provider.getDiscoveryMetadata('https://example.com');
      
      expect(metadata.code_challenge_methods_supported).toContain('S256');
    });
  });

  describe('Resource Parameter Implementation (RFC 8707)', () => {
    it('should validate valid resource URIs', () => {
      const validUris = [
        'https://example.com',
        'https://example.com/mcp',
        'https://example.com:8443',
        'http://localhost:3000',
        'http://127.0.0.1:8080'
      ];

      validUris.forEach(uri => {
        expect((provider as any).validateResourceUri(uri)).toBe(true);
      });
    });

    it('should reject invalid resource URIs', () => {
      const invalidUris = [
        'http://example.com', // HTTP not allowed for remote hosts
        'https://example.com#fragment', // Fragments not allowed
        'example.com', // Missing scheme
        'ftp://example.com', // Wrong scheme
        'https://example.com?query=value#fragment' // Fragment not allowed
      ];

      invalidUris.forEach(uri => {
        expect((provider as any).validateResourceUri(uri)).toBe(false);
      });
    });

    it('should include resource parameter in authorization URL', async () => {
      const resource = 'https://mcp.example.com';
      const authUrl = await provider.getAuthUrl('test-state', 'http://localhost:3000/callback', resource);
      
      expect(authUrl).toContain(`resource=${encodeURIComponent(resource)}`);
    });
  });

  describe('HTTPS Enforcement (OAuth 2.1 Requirement)', () => {
    it('should validate HTTPS endpoints', () => {
      const httpsEndpoints = [
        'https://auth.example.com/authorize',
        'https://auth.example.com:8443/token'
      ];

      httpsEndpoints.forEach(endpoint => {
        expect((provider as any).validateHttpsEndpoint(endpoint)).toBe(true);
      });
    });

    it('should allow localhost HTTP endpoints', () => {
      const localhostEndpoints = [
        'http://localhost:3000/auth',
        'http://127.0.0.1:8080/token'
      ];

      localhostEndpoints.forEach(endpoint => {
        expect((provider as any).validateHttpsEndpoint(endpoint, true)).toBe(true);
      });
    });

    it('should reject non-HTTPS remote endpoints', () => {
      const httpEndpoints = [
        'http://auth.example.com/authorize',
        'http://remote.host.com:8080/token'
      ];

      httpEndpoints.forEach(endpoint => {
        expect((provider as any).validateHttpsEndpoint(endpoint)).toBe(false);
      });
    });

    it('should reject localhost HTTP when not allowed', () => {
      const localhostEndpoints = [
        'http://localhost:3000/auth',
        'http://127.0.0.1:8080/token'
      ];

      localhostEndpoints.forEach(endpoint => {
        expect((provider as any).validateHttpsEndpoint(endpoint, false)).toBe(false);
      });
    });
  });

  describe('Token Audience Validation', () => {
    it('should verify token with correct audience', async () => {
      const user = await provider.verifyToken('valid-token-with-audience', 'https://example.com');
      expect(user).not.toBeNull();
      expect(user?.id).toBe('1');
    });

    it('should reject token with wrong audience', async () => {
      const user = await provider.verifyToken('valid-token-with-audience', 'https://wrong.com');
      expect(user).toBeNull();
    });

    it('should accept token when no audience validation required', async () => {
      const user = await provider.verifyToken('valid-token-no-audience');
      expect(user).not.toBeNull();
    });

    it('should reject invalid tokens', async () => {
      const user = await provider.verifyToken('invalid-token', 'https://example.com');
      expect(user).toBeNull();
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle malformed resource URIs gracefully', () => {
      const malformedUris = [
        '',
        'not-a-url',
        'https://',
        'https://[invalid-ipv6'
      ];

      malformedUris.forEach(uri => {
        expect(() => (provider as any).validateResourceUri(uri)).not.toThrow();
        expect((provider as any).validateResourceUri(uri)).toBe(false);
      });
    });

    it('should handle malformed endpoint URLs gracefully', () => {
      const malformedEndpoints = [
        '',
        'not-a-url',
        'https://',
        'http://'
      ];

      malformedEndpoints.forEach(endpoint => {
        expect(() => (provider as any).validateHttpsEndpoint(endpoint)).not.toThrow();
        expect((provider as any).validateHttpsEndpoint(endpoint)).toBe(false);
      });
    });

    it('should generate unique PKCE parameters on each call', () => {
      const params1 = (provider as any).generatePKCEParams();
      const params2 = (provider as any).generatePKCEParams();
      
      expect(params1.codeVerifier).not.toBe(params2.codeVerifier);
      expect(params1.codeChallenge).not.toBe(params2.codeChallenge);
    });
  });
});
