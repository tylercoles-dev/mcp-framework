import { Request, Router } from 'express';
import { 
  OAuthProvider, 
  User, 
  TokenResult, 
  OAuthDiscovery,
  ProtectedResourceMetadata,
  ClientRegistrationRequest,
  ClientRegistrationResponse,
  PKCEParams,
  createOAuthError,
  OAuthErrorResponse
} from '@tylercoles/mcp-auth';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import { z } from 'zod';

/**
 * Extended token result with OIDC ID token
 */
export interface OIDCTokenResult extends TokenResult {
  idToken?: string;
}

/**
 * Generic OIDC provider configuration
 */
export interface OIDCConfig {
  // Discovery endpoint or manual configuration
  discoveryUrl?: string;
  issuer?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  revocationEndpoint?: string;
  introspectionEndpoint?: string;
  registrationEndpoint?: string;
  
  // Client configuration
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  
  // Token validation
  validateAudience?: boolean;
  expectedAudience?: string | string[];
  validateIssuer?: boolean;
  clockTolerance?: number;
  
  // Claims mapping
  idClaim?: string; // Default: 'sub'
  usernameClaim?: string; // Default: 'preferred_username' or 'email'
  emailClaim?: string; // Default: 'email'
  nameClaim?: string; // Default: 'name'
  groupsClaim?: string; // Default: 'groups' or 'roles'
  
  // Access control
  allowedGroups?: string[];
  
  // Advanced options
  tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post' | 'none';
  useIdToken?: boolean; // Use ID token for user info instead of userinfo endpoint
  additionalAuthParams?: Record<string, string>;
}

/**
 * OIDC discovery response schema
 */
const OIDCDiscoverySchema = z.object({
  issuer: z.string(),
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  userinfo_endpoint: z.string().optional(),
  jwks_uri: z.string(),
  revocation_endpoint: z.string().optional(),
  introspection_endpoint: z.string().optional(),
  registration_endpoint: z.string().optional(),
  scopes_supported: z.array(z.string()).optional(),
  response_types_supported: z.array(z.string()).optional(),
  grant_types_supported: z.array(z.string()).optional(),
  subject_types_supported: z.array(z.string()).optional(),
  id_token_signing_alg_values_supported: z.array(z.string()).optional(),
  token_endpoint_auth_methods_supported: z.array(z.string()).optional(),
  code_challenge_methods_supported: z.array(z.string()).optional(),
});

type OIDCDiscoveryType = z.infer<typeof OIDCDiscoverySchema>;

/**
 * Token response schema
 */
const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  id_token: z.string().optional(),
});

/**
 * Generic OpenID Connect provider implementation
 */
export class OIDCProvider extends OAuthProvider {
  private config: Required<OIDCConfig>;
  private discoveryCache: OIDCDiscoveryType | null = null;

  constructor(config: OIDCConfig) {
    super();
    
    // Apply defaults
    this.config = {
      scopes: ['openid', 'profile', 'email'],
      idClaim: 'sub',
      usernameClaim: 'preferred_username',
      emailClaim: 'email',
      nameClaim: 'name',
      groupsClaim: 'groups',
      validateAudience: true,
      validateIssuer: true,
      clockTolerance: 60,
      tokenEndpointAuthMethod: 'client_secret_post',
      useIdToken: false,
      allowedGroups: [],
      additionalAuthParams: {},
      ...config
    } as Required<OIDCConfig>;
    
    // Validate configuration
    if (!config.discoveryUrl && (!config.issuer || !config.authorizationEndpoint || !config.tokenEndpoint)) {
      throw new Error('Either discoveryUrl or manual endpoint configuration (issuer, authorizationEndpoint, tokenEndpoint) must be provided');
    }
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    // Fetch discovery document if using discovery URL
    if (this.config.discoveryUrl) {
      await this.fetchDiscovery();
    }
  }

  /**
   * Fetch and cache OIDC discovery document
   */
  private async fetchDiscovery(): Promise<void> {
    if (!this.config.discoveryUrl) {
      throw new Error('Discovery URL not configured');
    }
    
    try {
      const response = await fetch(this.config.discoveryUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch discovery document: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.discoveryCache = OIDCDiscoverySchema.parse(data);
    } catch (error) {
      console.error('Failed to fetch OIDC discovery:', error);
      throw new Error(`Failed to fetch OIDC configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get discovery configuration
   */
  private async getDiscovery(): Promise<OIDCDiscoveryType> {
    if (this.discoveryCache) {
      return this.discoveryCache;
    }
    
    if (this.config.discoveryUrl) {
      await this.fetchDiscovery();
      return this.discoveryCache!;
    }
    
    // Build discovery from manual configuration
    return {
      issuer: this.config.issuer!,
      authorization_endpoint: this.config.authorizationEndpoint!,
      token_endpoint: this.config.tokenEndpoint!,
      userinfo_endpoint: this.config.userinfoEndpoint,
      jwks_uri: this.config.jwksUri!,
      revocation_endpoint: this.config.revocationEndpoint,
      introspection_endpoint: this.config.introspectionEndpoint,
      registration_endpoint: this.config.registrationEndpoint,
      scopes_supported: this.config.scopes,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256', 'plain'],
    };
  }

  /**
   * Get authorization URL
   */
  async getAuthUrl(
    state?: string,
    redirectUri?: string,
    resource?: string,
    pkceParams?: PKCEParams
  ): Promise<string> {
    const discovery = await this.getDiscovery();
    
    // Validate HTTPS endpoint
    if (!this.validateHttpsEndpoint(discovery.authorization_endpoint)) {
      throw new Error('Authorization endpoint must use HTTPS in production');
    }
    
    // Validate resource URI if provided
    if (resource && !this.validateResourceUri(resource)) {
      throw new Error('Invalid resource URI format');
    }
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      redirect_uri: redirectUri || this.config.redirectUri || '',
      ...this.config.additionalAuthParams,
    });
    
    if (state) {
      params.set('state', state);
    }
    
    if (resource) {
      params.set('resource', resource);
    }
    
    if (pkceParams) {
      params.set('code_challenge', pkceParams.codeChallenge);
      params.set('code_challenge_method', pkceParams.codeChallengeMethod);
    }
    
    return `${discovery.authorization_endpoint}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(
    code: string,
    state?: string,
    redirectUri?: string,
    resource?: string,
    codeVerifier?: string
  ): Promise<OIDCTokenResult> {
    const discovery = await this.getDiscovery();
    
    // Validate HTTPS endpoint
    if (!this.validateHttpsEndpoint(discovery.token_endpoint)) {
      throw new Error('Token endpoint must use HTTPS in production');
    }
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri || this.config.redirectUri || '',
      client_id: this.config.clientId,
    });
    
    if (this.config.clientSecret && this.config.tokenEndpointAuthMethod === 'client_secret_post') {
      params.set('client_secret', this.config.clientSecret);
    }
    
    if (resource) {
      params.set('resource', resource);
    }
    
    if (codeVerifier) {
      params.set('code_verifier', codeVerifier);
    }
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      
      // Add basic auth if using client_secret_basic
      if (this.config.clientSecret && this.config.tokenEndpointAuthMethod === 'client_secret_basic') {
        const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
      
      const response = await fetch(discovery.token_endpoint, {
        method: 'POST',
        headers,
        body: params.toString(),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData && typeof errorData === 'object' && 'error' in errorData) {
          const oauthError = createOAuthError(
            String(errorData.error || 'server_error'),
            (errorData as any).error_description ? String((errorData as any).error_description) : undefined,
            (errorData as any).error_uri ? String((errorData as any).error_uri) : undefined
          );
          // Use the original error string directly since createOAuthError might modify it
          const errorMessage = String(errorData.error || 'server_error');
          throw new Error(errorMessage);
        }
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      const tokenResponse = TokenResponseSchema.parse(data);
      
      return {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenType: tokenResponse.token_type,
        expiresIn: tokenResponse.expires_in,
        scope: tokenResponse.scope,
        idToken: tokenResponse.id_token,
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      if ((error as any).error) {
        // Convert OAuth error to regular Error
        const errorMessage = String((error as any).error || 'OAuth error');
        throw new Error(errorMessage);
      }
      throw new Error(error instanceof Error ? error.message : 'Token exchange failed');
    }
  }

  /**
   * Verify an access token
   */
  async verifyToken(token: string, expectedAudience?: string): Promise<User | null> {
    try {
      // If using ID tokens, decode and verify the ID token
      if (this.config.useIdToken) {
        return this.verifyIdToken(token, expectedAudience);
      }
      
      // Otherwise, use the userinfo endpoint
      const discovery = await this.getDiscovery();
      
      if (!discovery.userinfo_endpoint) {
        throw new Error('UserInfo endpoint not available');
      }
      
      // Validate HTTPS endpoint
      if (!this.validateHttpsEndpoint(discovery.userinfo_endpoint)) {
        throw new Error('UserInfo endpoint must use HTTPS in production');
      }
      
      const response = await fetch(discovery.userinfo_endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          return null; // Invalid token
        }
        throw new Error(`UserInfo request failed: ${response.statusText}`);
      }
      
      const userInfo = await response.json();
      return this.mapClaimsToUser(userInfo);
    } catch (error) {
      console.error('Failed to verify token:', error);
      // Check if it's a 401 error (unauthorized token)
      if (error instanceof Error && (
        error.message.includes('401') || 
        error.message.includes('Unauthorized')
      )) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Verify ID token (simplified - just decode without verification for now)
   */
  private async verifyIdToken(idToken: string, expectedAudience?: string): Promise<User | null> {
    try {
      // For now, just decode the token without verification
      // In a production environment, you would want to fetch the JWKS and verify the signature
      const decoded = jwt.decode(idToken) as jwt.JwtPayload;
      if (!decoded) {
        throw new Error('Invalid ID token format');
      }
      
      return this.mapClaimsToUser(decoded);
    } catch (error) {
      console.error('ID token verification failed:', error);
      return null;
    }
  }

  /**
   * Map OIDC claims to User object
   */
  private mapClaimsToUser(claims: any): User | null {
    const id = claims[this.config.idClaim];
    if (!id) {
      console.error(`Missing required claim: ${this.config.idClaim}`);
      return null;
    }
    
    const username = claims[this.config.usernameClaim] || claims[this.config.emailClaim] || id;
    const email = claims[this.config.emailClaim] || '';
    const name = claims[this.config.nameClaim] || '';
    const groups = claims[this.config.groupsClaim] || [];
    
    // Check group restrictions
    if (this.config.allowedGroups && this.config.allowedGroups.length > 0) {
      const hasAllowedGroup = this.config.allowedGroups.some(
        group => groups.includes(group)
      );
      
      if (!hasAllowedGroup) {
        console.warn(`User ${id} not in allowed groups`);
        return null;
      }
    }
    
    return {
      id: String(id),
      username: String(username),
      email: String(email),
      name: String(name),
      groups: Array.isArray(groups) ? groups.map(g => String(g)) : [],
      // Include all other claims
      ...claims,
    };
  }

  /**
   * Refresh an access token
   */
  async refreshToken(refreshToken: string, resource?: string): Promise<OIDCTokenResult> {
    const discovery = await this.getDiscovery();
    
    // Validate HTTPS endpoint
    if (!this.validateHttpsEndpoint(discovery.token_endpoint)) {
      throw new Error('Token endpoint must use HTTPS in production');
    }
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
    });
    
    if (this.config.clientSecret && this.config.tokenEndpointAuthMethod === 'client_secret_post') {
      params.set('client_secret', this.config.clientSecret);
    }
    
    if (resource) {
      params.set('resource', resource);
    }
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      
      // Add basic auth if using client_secret_basic
      if (this.config.clientSecret && this.config.tokenEndpointAuthMethod === 'client_secret_basic') {
        const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
      
      const response = await fetch(discovery.token_endpoint, {
        method: 'POST',
        headers,
        body: params.toString(),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData && typeof errorData === 'object' && 'error' in errorData) {
          const oauthError = createOAuthError(
            String(errorData.error || 'server_error'),
            (errorData as any).error_description ? String((errorData as any).error_description) : undefined,
            (errorData as any).error_uri ? String((errorData as any).error_uri) : undefined
          );
          // Use the original error string directly since createOAuthError might modify it
          const errorMessage = String(errorData.error || 'server_error');
          throw new Error(errorMessage);
        }
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      const tokenResponse = TokenResponseSchema.parse(data);
      
      return {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenType: tokenResponse.token_type,
        expiresIn: tokenResponse.expires_in,
        scope: tokenResponse.scope,
        idToken: tokenResponse.id_token,
      };
    } catch (error) {
      console.error('Failed to refresh token:', error);
      if ((error as any).error) {
        // Convert OAuth error to regular Error
        const errorMessage = String((error as any).error || 'OAuth error');
        throw new Error(errorMessage);
      }
      throw new Error(error instanceof Error ? error.message : 'Token refresh failed');
    }
  }

  /**
   * Revoke a token
   */
  async revokeToken(token: string, tokenType: 'access_token' | 'refresh_token' = 'access_token'): Promise<void> {
    const discovery = await this.getDiscovery();
    
    if (!discovery.revocation_endpoint) {
      console.warn('OIDC provider does not support token revocation');
      return;
    }
    
    // Validate HTTPS endpoint
    if (!this.validateHttpsEndpoint(discovery.revocation_endpoint)) {
      throw new Error('Revocation endpoint must use HTTPS in production');
    }
    
    const params = new URLSearchParams({
      token,
      token_type_hint: tokenType,
      client_id: this.config.clientId,
    });
    
    if (this.config.clientSecret && this.config.tokenEndpointAuthMethod === 'client_secret_post') {
      params.set('client_secret', this.config.clientSecret);
    }
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      
      // Add basic auth if using client_secret_basic
      if (this.config.clientSecret && this.config.tokenEndpointAuthMethod === 'client_secret_basic') {
        const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
      
      const response = await fetch(discovery.revocation_endpoint, {
        method: 'POST',
        headers,
        body: params.toString(),
      });
      
      if (!response.ok) {
        console.warn(`Token revocation failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to revoke token:', error);
      // Token revocation failures are often not critical
    }
  }

  /**
   * Authenticate a request
   */
  async authenticate(req: Request): Promise<User | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const expectedAudience = this.config.expectedAudience || `${req.protocol}://${req.get('host')}`;
    
    return this.verifyToken(token, Array.isArray(expectedAudience) ? expectedAudience[0] : expectedAudience);
  }

  /**
   * Get user from request (sync - not applicable for stateless OIDC)
   */
  getUser(req: Request): User | null {
    // OIDC is typically stateless, so this returns null
    // Override this method if implementing session-based authentication
    return null;
  }

  /**
   * Get OAuth discovery metadata
   */
  getDiscoveryMetadata(baseUrl: string): OAuthDiscovery {
    if (this.discoveryCache) {
      return {
        ...this.discoveryCache,
        issuer: this.discoveryCache.issuer,
        userinfo_endpoint: this.discoveryCache.userinfo_endpoint || `${baseUrl}/userinfo`,
        jwks_uri: this.discoveryCache.jwks_uri,
        scopes_supported: this.discoveryCache.scopes_supported || this.config.scopes,
        response_types_supported: this.discoveryCache.response_types_supported || ['code'],
        grant_types_supported: this.discoveryCache.grant_types_supported || ['authorization_code', 'refresh_token'],
        subject_types_supported: this.discoveryCache.subject_types_supported || ['public'],
      };
    }
    
    // Build from config
    const discovery: OAuthDiscovery = {
      issuer: this.config.issuer || baseUrl,
      authorization_endpoint: this.config.authorizationEndpoint!,
      token_endpoint: this.config.tokenEndpoint!,
      userinfo_endpoint: this.config.userinfoEndpoint || `${baseUrl}/userinfo`,
      jwks_uri: this.config.jwksUri!,
      registration_endpoint: this.config.registrationEndpoint,
      scopes_supported: this.config.scopes,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256', 'plain'],
    };
    
    return discovery;
  }

  /**
   * Get protected resource metadata
   */
  getProtectedResourceMetadata(baseUrl: string): ProtectedResourceMetadata {
    return {
      resource: baseUrl,
      authorization_servers: [this.config.issuer || this.getDiscoveryMetadata(baseUrl).issuer],
    };
  }

  /**
   * Check if dynamic registration is supported
   */
  supportsDynamicRegistration(): boolean {
    return !!this.config.registrationEndpoint || !!this.discoveryCache?.registration_endpoint;
  }

  /**
   * Register a client dynamically
   */
  async registerClient(request: ClientRegistrationRequest): Promise<ClientRegistrationResponse> {
    const discovery = await this.getDiscovery();
    
    if (!discovery.registration_endpoint) {
      throw new Error('Dynamic client registration not supported by this OIDC provider');
    }
    
    // Validate HTTPS endpoint
    if (!this.validateHttpsEndpoint(discovery.registration_endpoint)) {
      throw new Error('Registration endpoint must use HTTPS in production');
    }
    
    try {
      const response = await fetch(discovery.registration_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData && typeof errorData === 'object' && 'error' in errorData) {
          const oauthError = createOAuthError(
            String(errorData.error || 'server_error'),
            (errorData as any).error_description ? String((errorData as any).error_description) : undefined,
            (errorData as any).error_uri ? String((errorData as any).error_uri) : undefined
          );
          // Use the original error string directly since createOAuthError might modify it
          const errorMessage = String(errorData.error || 'server_error');
          throw new Error(errorMessage);
        }
        throw new Error(`Client registration failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data as ClientRegistrationResponse;
    } catch (error) {
      console.error('Failed to register client:', error);
      if ((error as any).error) {
        // Convert OAuth error to regular Error
        const errorMessage = String((error as any).error || 'OAuth error');
        throw new Error(errorMessage);
      }
      throw new Error(error instanceof Error ? error.message : 'Client registration failed');
    }
  }

  /**
   * Setup OAuth routes (optional - override for session-based auth)
   */
  setupRoutes(router: Router): void {
    // By default, OIDC providers don't need routes as they're stateless
    // Override this method to add session-based authentication routes
    console.log('OIDC provider initialized (stateless mode)');
  }
}

/**
 * Utility function to create OIDC provider quickly
 */
export function createOIDCProvider(config: OIDCConfig): OIDCProvider {
  return new OIDCProvider(config);
}

/**
 * Pre-configured provider factories
 */
export const Providers = {
  /**
   * Create Auth0 provider
   */
  Auth0: (domain: string, clientId: string, clientSecret?: string, config?: Partial<OIDCConfig>) => 
    new OIDCProvider({
      discoveryUrl: `https://${domain}/.well-known/openid-configuration`,
      clientId,
      clientSecret,
      ...config,
    }),
  
  /**
   * Create Okta provider
   */
  Okta: (domain: string, clientId: string, clientSecret?: string, config?: Partial<OIDCConfig>) =>
    new OIDCProvider({
      discoveryUrl: `https://${domain}/.well-known/openid-configuration`,
      clientId,
      clientSecret,
      ...config,
    }),
  
  /**
   * Create Keycloak provider
   */
  Keycloak: (baseUrl: string, realm: string, clientId: string, clientSecret?: string, config?: Partial<OIDCConfig>) =>
    new OIDCProvider({
      discoveryUrl: `${baseUrl}/realms/${realm}/.well-known/openid-configuration`,
      clientId,
      clientSecret,
      ...config,
    }),
  
  /**
   * Create Google provider
   */
  Google: (clientId: string, clientSecret: string, config?: Partial<OIDCConfig>) =>
    new OIDCProvider({
      discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
      clientId,
      clientSecret,
      ...config,
    }),
  
  /**
   * Create Microsoft/Azure AD provider
   */
  Microsoft: (tenantId: string, clientId: string, clientSecret?: string, config?: Partial<OIDCConfig>) =>
    new OIDCProvider({
      discoveryUrl: `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`,
      clientId,
      clientSecret,
      ...config,
    }),
};