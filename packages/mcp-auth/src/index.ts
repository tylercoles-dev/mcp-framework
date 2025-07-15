import express, { Request, Response, Router } from 'express';

/**
 * User interface representing an authenticated user
 */
export interface User {
  id: string;
  username: string;
  email: string;
  groups: string[];
  [key: string]: any;
}

/**
 * Token result from OAuth flow
 */
export interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
  scope?: string;
}

/**
 * OAuth discovery metadata
 */
export interface OAuthDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri?: string;
  registration_endpoint?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  code_challenge_methods_supported?: string[];
}

/**
 * Protected resource metadata (RFC 9728)
 */
export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
}

/**
 * Dynamic client registration request/response
 */
export interface ClientRegistrationRequest {
  client_name: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
  [key: string]: any;
}

export interface ClientRegistrationResponse {
  client_id: string;
  client_secret?: string;
  registration_access_token?: string;
  registration_client_uri?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  [key: string]: any;
}

/**
 * Base authentication provider interface
 */
export abstract class AuthProvider {
  /**
   * Authenticate a request and return the user if valid
   */
  abstract authenticate(req: Request): Promise<User | null>;
  
  /**
   * Get the current user from a request (sync version for middleware)
   */
  abstract getUser(req: Request): User | null;
  
  /**
   * Optional: Initialize the auth provider
   */
  async initialize?(): Promise<void>;
  
  /**
   * Optional: Clean up resources
   */
  async shutdown?(): Promise<void>;
}

/**
 * OAuth-specific authentication provider
 */
export abstract class OAuthProvider extends AuthProvider {
  /**
   * Get the authorization URL for starting OAuth flow
   */
  abstract getAuthUrl(state?: string, redirectUri?: string): string | Promise<string>;
  
  /**
   * Handle the OAuth callback and exchange code for tokens
   */
  abstract handleCallback(code: string, state?: string, redirectUri?: string): Promise<TokenResult>;
  
  /**
   * Verify an access token and return the user
   */
  abstract verifyToken(token: string): Promise<User | null>;
  
  /**
   * Get OAuth discovery metadata
   */
  abstract getDiscoveryMetadata(baseUrl: string): OAuthDiscovery;
  
  /**
   * Get protected resource metadata
   */
  abstract getProtectedResourceMetadata(baseUrl: string): ProtectedResourceMetadata;
  
  /**
   * Optional: Refresh an access token
   */
  async refreshToken?(refreshToken: string): Promise<TokenResult> {
    throw new Error('Token refresh not implemented');
  }
  
  /**
   * Optional: Handle dynamic client registration
   */
  async registerClient?(request: ClientRegistrationRequest): Promise<ClientRegistrationResponse> {
    throw new Error('Dynamic client registration not implemented');
  }
  
  /**
   * Optional: Setup OAuth routes (login, callback, etc.)
   */
  setupRoutes?(router: Router): void {
    // Default implementation can be overridden
  }
  
  /**
   * Optional: Check if provider supports dynamic registration
   */
  supportsDynamicRegistration?(): boolean {
    return false;
  }
}

/**
 * No authentication provider (for development/testing)
 */
export class NoAuth extends AuthProvider {
  async authenticate(_req: Request): Promise<User | null> {
    return null;
  }
  
  getUser(_req: Request): User | null {
    return null;
  }
}

/**
 * Development authentication provider with mock users
 */
export class DevAuth extends AuthProvider {
  private mockUser: User;
  
  constructor(mockUser?: Partial<User>) {
    super();
    this.mockUser = {
      id: mockUser?.id || 'dev-user-123',
      username: mockUser?.username || 'developer',
      email: mockUser?.email || 'dev@example.com',
      groups: mockUser?.groups || ['developers'],
      ...mockUser
    };
  }
  
  async authenticate(_req: Request): Promise<User | null> {
    // In dev mode, always return the mock user
    return this.mockUser;
  }
  
  getUser(_req: Request): User | null {
    // In dev mode, always return the mock user
    return this.mockUser;
  }
}

/**
 * Bearer token authentication provider
 */
export abstract class BearerTokenAuth extends AuthProvider {
  async authenticate(req: Request): Promise<User | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    return this.verifyToken(token);
  }
  
  getUser(req: Request): User | null {
    // For sync middleware, we can't verify tokens synchronously
    // The authenticate method should be used instead
    return null;
  }
  
  /**
   * Verify a bearer token and return the user
   */
  abstract verifyToken(token: string): Promise<User | null>;
}

/**
 * Session-based authentication provider
 */
export abstract class SessionAuth extends AuthProvider {
  getUser(req: Request): User | null {
    // Assuming the user is stored in req.user by session middleware
    return (req as any).user || null;
  }
  
  async authenticate(req: Request): Promise<User | null> {
    return this.getUser(req);
  }
}

/**
 * Utility function to extract bearer token from request
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Utility function to create auth middleware
 */
export function createAuthMiddleware(provider: AuthProvider) {
  return async (req: Request, res: Response, next: any) => {
    try {
      const user = await provider.authenticate(req);
      if (user) {
        (req as any).user = user;
        next();
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };
}

/**
 * Create OAuth discovery routes for MCP compliance
 */
export function createOAuthDiscoveryRoutes(provider: OAuthProvider): Router {
  const router = Router();
  
  // Protected Resource Metadata (RFC 9728)
  router.get('/.well-known/oauth-protected-resource', (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    res.json(provider.getProtectedResourceMetadata(baseUrl));
  });
  
  // OAuth Authorization Server Metadata
  router.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    res.json(provider.getDiscoveryMetadata(baseUrl));
  });
  
  // Dynamic Client Registration (if supported)
  if (provider.supportsDynamicRegistration && provider.supportsDynamicRegistration()) {
    router.post('/application/o/register/', express.json(), async (req: Request, res: Response) => {
      try {
        if (!provider.registerClient) {
          res.status(501).json({
            error: 'temporarily_unavailable',
            error_description: 'Dynamic registration not available'
          });
          return;
        }
        
        const response = await provider.registerClient(req.body);
        res.json(response);
      } catch (error) {
        console.error('Client registration failed:', error);
        res.status(400).json({
          error: 'invalid_client_metadata',
          error_description: 'Failed to register client'
        });
      }
    });
  }
  
  // Let provider setup additional routes (login, callback, etc.)
  if (provider.setupRoutes) {
    provider.setupRoutes(router);
  }
  
  return router;
}

/**
 * Helper to get base URL from request
 */
function getBaseUrl(req: Request): string {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
}

// Re-export express for convenience
export { express };
