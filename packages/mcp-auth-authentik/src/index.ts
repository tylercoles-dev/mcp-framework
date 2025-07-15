import axios from 'axios';
import { Request, Router } from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect';
import {
  OAuthProvider,
  User,
  TokenResult,
  OAuthDiscovery,
  ProtectedResourceMetadata,
  ClientRegistrationRequest,
  ClientRegistrationResponse
} from '@tylercoles/mcp-auth';

/**
 * Authentik OAuth provider configuration
 */
export interface AuthentikConfig {
  url: string;
  clientId: string;
  clientSecret?: string;
  scopes?: string[];
  redirectUri?: string;
  applicationSlug?: string; // Authentik application slug (default: derived from clientId)
  allowedGroups?: string[]; // Optional: restrict access to specific groups
  sessionSecret?: string; // For passport session management
  registrationApiToken?: string; // API token for dynamic client registration (required for non-Claude clients)
}

/**
 * Authentik user info response
 */
interface AuthentikUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  preferred_username: string;
  nickname?: string;
  groups?: string[];
  [key: string]: any;
}

/**
 * Authentik OAuth provider implementation with full MCP support
 */
export class AuthentikAuth extends OAuthProvider {
  private config: AuthentikConfig;
  private discoveryCache: any = null;
  private passportInitialized = false;

  constructor(config: AuthentikConfig) {
    super();
    this.config = {
      scopes: ['openid', 'profile', 'email'],
      applicationSlug: config.clientId,
      sessionSecret: config.sessionSecret || 'authentik-secret-change-me',
      ...config
    };
  }

  /**
   * Initialize passport if needed
   */
  async initialize(): Promise<void> {
    if (this.passportInitialized) return;

    // Configure passport strategy
    passport.use('authentik', new OpenIDConnectStrategy({
      issuer: `${this.config.url}/application/o/${this.config.applicationSlug}/`,
      authorizationURL: `${this.config.url}/application/o/authorize/`,
      tokenURL: `${this.config.url}/application/o/token/`,
      userInfoURL: `${this.config.url}/application/o/userinfo/`,
      clientID: this.config.clientId,
      clientSecret: this.config.clientSecret || '',
      callbackURL: this.config.redirectUri || '',
      scope: this.config.scopes,
      skipUserProfile: false,
      // state: true
    }, this.verifyCallback.bind(this)) as any);

    // Serialize/deserialize user
    passport.serializeUser((user: any, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
      // Simple deserialization - in production, fetch from database
      done(null, { id });
    });

    this.passportInitialized = true;
  }

  /**
   * Passport verify callback
   */
  private async verifyCallback(
    _issuer: string,
    profile: any,
    done: (error: any, user?: any) => void
  ): Promise<void> {
    try {
      const user = this.profileToUser(profile);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }

  /**
   * Convert passport profile to User
   */
  private profileToUser(profile: any): User {
    const userId = profile.id || profile.sub || profile.user_id || profile.pk;
    const username = profile.username || profile.preferred_username || profile.nickname || profile.name;
    const email = profile.email || profile.emails?.[0]?.value || profile.emails?.[0] || '';
    const groups = profile.groups || profile.roles || [];

    if (!userId || !username) {
      throw new Error('Invalid profile data');
    }

    // Check group restrictions if configured
    if (this.config.allowedGroups && this.config.allowedGroups.length > 0) {
      const hasAllowedGroup = this.config.allowedGroups.some(
        group => groups.includes(group)
      );

      if (!hasAllowedGroup) {
        throw new Error('User not in allowed groups');
      }
    }

    return {
      id: String(userId),
      username: String(username),
      email: String(email),
      groups: Array.isArray(groups) ? groups.map(g => String(g)) : []
    };
  }

  /**
   * Get OAuth endpoints from Authentik discovery
   */
  private async getDiscovery(): Promise<any> {
    if (this.discoveryCache) {
      return this.discoveryCache;
    }

    const discoveryUrl = `${this.config.url}/application/o/${this.config.applicationSlug}/.well-known/openid-configuration`;

    try {
      const response = await axios.get(discoveryUrl);
      this.discoveryCache = response.data;
      return this.discoveryCache;
    } catch (error) {
      console.error('Failed to fetch Authentik discovery document:', error);
      throw new Error('Failed to fetch OAuth configuration from Authentik');
    }
  }

  /**
   * Get the authorization URL for starting OAuth flow
   */
  async getAuthUrl(state?: string, redirectUri?: string): Promise<string> {
    const discovery = await this.getDiscovery();
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      scope: this.config.scopes!.join(' '),
      redirect_uri: redirectUri || this.config.redirectUri || '',
    });

    if (state) {
      params.set('state', state);
    }

    return `${discovery.authorization_endpoint}?${params.toString()}`;
  }

  /**
   * Handle the OAuth callback and exchange code for tokens
   */
  async handleCallback(code: string, state?: string, redirectUri?: string): Promise<TokenResult> {
    const discovery = await this.getDiscovery();

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri || this.config.redirectUri || '',
      client_id: this.config.clientId,
    });

    if (this.config.clientSecret) {
      params.set('client_secret', this.config.clientSecret);
    }

    try {
      const response = await axios.post(discovery.token_endpoint, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        tokenType: response.data.token_type,
        expiresIn: response.data.expires_in,
        scope: response.data.scope,
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Verify an access token and return the user
   */
  async verifyToken(token: string): Promise<User | null> {
    const discovery = await this.getDiscovery();

    try {
      const response = await axios.get<AuthentikUserInfo>(discovery.userinfo_endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const userInfo = response.data;

      // Check group restrictions if configured
      if (this.config.allowedGroups && this.config.allowedGroups.length > 0) {
        const userGroups = userInfo.groups || [];
        const hasAllowedGroup = this.config.allowedGroups.some(
          group => userGroups.includes(group)
        );

        if (!hasAllowedGroup) {
          console.warn(`User ${userInfo.sub} not in allowed groups`);
          return null;
        }
      }

      return {
        ...userInfo, // Include any additional claims
        id: userInfo.sub,
        username: userInfo.preferred_username || userInfo.nickname || userInfo.email,
        email: userInfo.email,
        groups: userInfo.groups || [],
        name: userInfo.name,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        email_verified: userInfo.email_verified,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Invalid token
        return null;
      }
      console.error('Failed to verify token:', error);
      throw new Error('Failed to verify access token');
    }
  }

  /**
   * Refresh an access token
   */
  async refreshToken(refreshToken: string): Promise<TokenResult> {
    const discovery = await this.getDiscovery();

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
    });

    if (this.config.clientSecret) {
      params.set('client_secret', this.config.clientSecret);
    }

    try {
      const response = await axios.post(discovery.token_endpoint, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        tokenType: response.data.token_type,
        expiresIn: response.data.expires_in,
        scope: response.data.scope,
      };
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Authenticate a request (Bearer token or session)
   */
  async authenticate(req: Request): Promise<User | null> {
    // First try bearer token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return this.verifyToken(token);
    }

    // Then try session
    if ((req as any).user) {
      return (req as any).user;
    }

    return null;
  }

  /**
   * Get user from request (sync - for session)
   */
  getUser(req: Request): User | null {
    return (req as any).user || null;
  }

  /**
   * Get OAuth discovery metadata
   */
  getDiscoveryMetadata(baseUrl: string): OAuthDiscovery {
    return {
      issuer: `${this.config.url}/application/o/${this.config.applicationSlug}/`,
      authorization_endpoint: `${this.config.url}/application/o/authorize/`,
      token_endpoint: `${this.config.url}/application/o/token/`,
      userinfo_endpoint: `${this.config.url}/application/o/userinfo/`,
      jwks_uri: `${this.config.url}/application/o/${this.config.applicationSlug}/jwks/`,
      registration_endpoint: this.supportsDynamicRegistration() ? `${baseUrl}/application/o/register/` : undefined,
      scopes_supported: ["openid", "profile", "email"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
      code_challenge_methods_supported: ["S256", "plain"]
    };
  }

  /**
   * Get protected resource metadata
   */
  getProtectedResourceMetadata(baseUrl: string): ProtectedResourceMetadata {
    return {
      resource: baseUrl,
      authorization_servers: [`${this.config.url}/application/o/${this.config.applicationSlug}/`]
    };
  }

  /**
   * Check if dynamic registration is supported
   */
  supportsDynamicRegistration(): boolean {
    // Dynamic registration is supported if we have an API token
    // or if we're handling Claude.ai (which uses pre-configured client)
    return !!this.config.registrationApiToken || true; // Always return true for Claude.ai fallback
  }

  /**
   * Test if the API token has the required permissions for dynamic registration
   */
  async validateRegistrationToken(): Promise<boolean> {
    if (!this.config.registrationApiToken) {
      return false;
    }

    try {
      // Test by making a simple API call that requires the necessary permissions
      const response = await axios.get(
        `${this.config.url}/api/v3/providers/oauth2/?page_size=1`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.registrationApiToken}`
          }
        }
      );

      return response.status === 200;
    } catch (error) {
      console.error('API token validation failed:', error);
      return false;
    }
  }

  /**
   * Handle dynamic client registration
   */
  async registerClient(request: ClientRegistrationRequest): Promise<ClientRegistrationResponse> {
    // Special handling for Claude.ai
    if (request.client_name === 'claudeai') {
      console.log('Returning pre-configured client for Claude.ai');
      return {
        client_id: this.config.clientId,
        client_secret: '',
        registration_access_token: 'not-used',
        registration_client_uri: `${request.redirect_uris[0]}/register/${this.config.clientId}`,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0,
        redirect_uris: request.redirect_uris,
        token_endpoint_auth_method: 'client_secret_post',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: 'openid profile email'
      };
    }

    // Real dynamic registration using Authentik API
    if (!this.config.registrationApiToken) {
      throw new Error('Dynamic registration requires API token configuration');
    }

    try {
      // Generate a unique name for the provider and application
      const timestamp = Date.now();
      const providerName = `mcp-${request.client_name}-${timestamp}`;
      const appName = `MCP ${request.client_name}`;

      // Step 1: Create OAuth2 Provider
      const providerResponse = await axios.post(
        `${this.config.url}/api/v3/providers/oauth2/`,
        {
          name: providerName,
          client_type: 'confidential',
          client_id: `mcp-${timestamp}`,
          authorization_flow: 'default-authorization-flow',
          redirect_uris: request.redirect_uris.join('\n'),
          signing_key: 'default-key', // Use default signing key
          access_code_validity: 'minutes=10',
          access_token_validity: 'minutes=5',
          refresh_token_validity: 'days=30',
          include_claims_in_id_token: true,
          issuer_mode: 'per_provider',
          scopes: request.scope || 'openid profile email',
          sub_mode: 'user_id'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.registrationApiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const provider = providerResponse.data;

      // Step 2: Create Application
      const applicationResponse = await axios.post(
        `${this.config.url}/api/v3/core/applications/`,
        {
          name: appName,
          slug: `mcp-${request.client_name}-${timestamp}`,
          provider: provider.pk,
          meta_launch_url: request.redirect_uris[0] || '',
          meta_description: `MCP application for ${request.client_name}`,
          meta_publisher: 'MCP Framework',
          policy_engine_mode: 'any',
          open_in_new_tab: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.registrationApiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const application = applicationResponse.data;

      // Step 3: Get the client secret from the provider
      const providerDetailsResponse = await axios.get(
        `${this.config.url}/api/v3/providers/oauth2/${provider.pk}/`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.registrationApiToken}`
          }
        }
      );

      const clientSecret = providerDetailsResponse.data.client_secret;

      // Return the registration response
      return {
        client_id: provider.client_id,
        client_secret: clientSecret,
        registration_access_token: this.config.registrationApiToken,
        registration_client_uri: `${this.config.url}/api/v3/core/applications/${application.pk}/`,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0, // Authentik doesn't expire client secrets by default
        redirect_uris: request.redirect_uris,
        token_endpoint_auth_method: 'client_secret_post',
        grant_types: request.grant_types || ['authorization_code', 'refresh_token'],
        response_types: request.response_types || ['code'],
        scope: request.scope || 'openid profile email',
        // Additional Authentik-specific fields
        provider_pk: provider.pk,
        application_pk: application.pk,
        application_slug: application.slug
      };

    } catch (error: any) {
      console.error('Authentik dynamic registration failed:', error);
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;
        
        if (status === 401) {
          throw new Error('Invalid API token for dynamic registration');
        } else if (status === 403) {
          throw new Error('Insufficient permissions for dynamic registration');
        } else if (status === 400) {
          throw new Error(`Invalid registration request: ${JSON.stringify(data)}`);
        }
      }
      
      throw new Error(`Dynamic registration failed: ${error.message}`);
    }
  }

  /**
   * Revoke/delete a dynamically registered client
   */
  async revokeRegistration(clientId: string, registrationAccessToken?: string): Promise<void> {
    if (!this.config.registrationApiToken && !registrationAccessToken) {
      throw new Error('API token required for client revocation');
    }

    const token = registrationAccessToken || this.config.registrationApiToken;

    try {
      // First, find the provider with this client_id
      const providersResponse = await axios.get(
        `${this.config.url}/api/v3/providers/oauth2/?client_id=${encodeURIComponent(clientId)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const providers = providersResponse.data.results;
      if (!providers || providers.length === 0) {
        console.warn(`No provider found with client_id: ${clientId}`);
        return;
      }

      const provider = providers[0];

      // Find applications using this provider
      const applicationsResponse = await axios.get(
        `${this.config.url}/api/v3/core/applications/?provider=${provider.pk}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const applications = applicationsResponse.data.results;

      // Delete applications first
      for (const app of applications) {
        await axios.delete(
          `${this.config.url}/api/v3/core/applications/${app.pk}/`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        console.log(`Deleted application: ${app.name}`);
      }

      // Then delete the provider
      await axios.delete(
        `${this.config.url}/api/v3/providers/oauth2/${provider.pk}/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log(`Deleted OAuth2 provider: ${provider.name}`);

    } catch (error: any) {
      console.error('Failed to revoke client registration:', error);
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          throw new Error('Invalid token for client revocation');
        } else if (status === 404) {
          console.warn(`Client ${clientId} not found or already deleted`);
          return;
        }
      }
      
      throw new Error(`Client revocation failed: ${error.message}`);
    }
  }

  /**
   * Setup OAuth routes
   */
  setupRoutes(router: Router): void {
    // Initialize passport first
    this.initialize().catch(console.error);

    // Login route
    router.get('/auth/login', (req, res, next) => {
      // Ensure passport is initialized
      if (!this.passportInitialized) {
        res.status(503).json({ error: 'Auth system initializing' });
        return;
      }
      passport.authenticate('authentik')(req, res, next);
    });

    // Callback route
    router.get('/auth/callback',
      (req, res, next) => {
        if (!this.passportInitialized) {
          res.status(503).json({ error: 'Auth system initializing' });
          return;
        }
        next();
      },
      passport.authenticate('authentik', {
        failureRedirect: '/auth/error'
      }),
      (_req, res) => {
        res.redirect('/');
      }
    );

    // Logout route
    router.post('/auth/logout', (req, res) => {
      (req as any).logout((err: any) => {
        if (err) {
          res.status(500).json({ error: 'Logout failed' });
          return;
        }
        res.json({ success: true });
      });
    });

    // User info
    router.get('/auth/user', (req, res) => {
      const user = this.getUser(req);
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      res.json({ user });
    });

    // Error page
    router.get('/auth/error', (_req, res) => {
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Please check your credentials and try again'
      });
    });

    // Setup session middleware
    router.use(session({
      secret: this.config.sessionSecret!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));

    // Initialize passport middleware
    router.use(passport.initialize());
    router.use(passport.session());
  }

  /**
   * Revoke a token (if supported by Authentik)
   */
  async revokeToken(token: string, tokenType: 'access_token' | 'refresh_token' = 'access_token'): Promise<void> {
    const discovery = await this.getDiscovery();

    if (!discovery.revocation_endpoint) {
      console.warn('Authentik does not support token revocation');
      return;
    }

    const params = new URLSearchParams({
      token,
      token_type_hint: tokenType,
      client_id: this.config.clientId,
    });

    if (this.config.clientSecret) {
      params.set('client_secret', this.config.clientSecret);
    }

    try {
      await axios.post(discovery.revocation_endpoint, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      console.error('Failed to revoke token:', error);
      // Token revocation failures are often not critical
    }
  }
}

/**
 * Utility function to create Authentik auth quickly
 */
export function createAuthentikAuth(config: AuthentikConfig): AuthentikAuth {
  return new AuthentikAuth(config);
}
