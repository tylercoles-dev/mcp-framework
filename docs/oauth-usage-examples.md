# OAuth 2.1 Usage Examples

This document provides examples of how to use the OAuth 2.1 features in the MCP Framework, including PKCE, resource parameters, and audience validation.

## Table of Contents
- [Basic Authentik OAuth Setup](#basic-authentik-oauth-setup)
- [PKCE Flow Example](#pkce-flow-example)
- [Resource Parameter Usage](#resource-parameter-usage)
- [Token Audience Validation](#token-audience-validation)
- [Complete MCP Server Example](#complete-mcp-server-example)

## Basic Authentik OAuth Setup

```typescript
import { AuthentikAuth } from '@tylercoles/mcp-auth-authentik';
import { HttpTransport } from '@tylercoles/mcp-transport-http';
import { MCPServer } from '@tylercoles/mcp-server';

// Configure Authentik OAuth provider
const authProvider = new AuthentikAuth({
  url: 'https://auth.example.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret', // Optional for public clients
  redirectUri: 'https://your-mcp-server.com/auth/callback',
  scopes: ['openid', 'profile', 'email'],
  allowedGroups: ['mcp-users'], // Optional: restrict access
});

// Create HTTP transport with OAuth
const transport = new HttpTransport({
  port: 3000,
  auth: authProvider,
  cors: {
    origin: ['https://your-client-app.com'],
    credentials: true
  }
});

// Create and start MCP server
const server = new MCPServer({
  name: 'oauth-mcp-server',
  version: '1.0.0'
});

server.useTransport(transport);
await server.start();
```

## PKCE Flow Example

The framework provides two ways to handle PKCE (Proof Key for Code Exchange) for enhanced security:

### Option 1: High-Level Convenience Methods (Recommended)

```typescript
import { AuthentikAuth } from '@tylercoles/mcp-auth-authentik';

const authProvider = new AuthentikAuth(config);

// Start OAuth flow with automatic PKCE generation
async function startOAuthFlow() {
  const state = 'random-state-value';
  const redirectUri = 'https://your-mcp-server.com/auth/callback';
  const resource = 'https://your-mcp-server.com'; // RFC 8707 Resource Indicator
  
  // PKCE parameters are automatically generated and stored
  const { authUrl } = await authProvider.startOAuthFlow(state, redirectUri, resource);
  
  console.log('Visit this URL to authorize:', authUrl);
  // URL includes: code_challenge, code_challenge_method=S256, resource, state
}

// Handle OAuth callback with automatic PKCE retrieval
async function handleCallback(code: string, state: string) {
  const redirectUri = 'https://your-mcp-server.com/auth/callback';
  const resource = 'https://your-mcp-server.com';
  
  try {
    // PKCE code_verifier is automatically retrieved and used
    const tokens = await authProvider.completeOAuthFlow(code, state, redirectUri, resource);
    
    console.log('OAuth successful:', tokens.accessToken);
  } catch (error) {
    console.error('OAuth failed:', error.message);
  }
}
```

### Option 2: Manual PKCE Parameter Management (Advanced)

```typescript
import { PKCEParams } from '@tylercoles/mcp-auth';

// For advanced users who need manual control over PKCE parameters
async function manualPKCEFlow() {
  const authProvider = new AuthentikAuth(config);
  
  // Generate PKCE parameters manually (you must store these!)
  const pkceParams = (authProvider as any).generatePKCEParams();
  const state = 'random-state-value';
  const redirectUri = 'https://your-mcp-server.com/auth/callback';
  const resource = 'https://your-mcp-server.com';
  
  // Start authorization with manual PKCE
  const authUrl = await authProvider.getAuthUrl(state, redirectUri, resource, pkceParams);
  console.log('Visit this URL:', authUrl);
  
  // Later, handle callback with stored PKCE verifier
  const tokens = await authProvider.handleCallback(
    code, 
    state, 
    redirectUri, 
    resource, 
    pkceParams.codeVerifier  // You must provide the stored verifier
  );
}
```

⚠️ **Important:** The manual approach requires you to securely store the `codeVerifier` between the authorization request and callback. The high-level convenience methods handle this automatically.
```

## Resource Parameter Usage

Resource parameters (RFC 8707) ensure tokens are bound to specific MCP servers:

```typescript
// The resource parameter should be the canonical URI of your MCP server
const resourceUri = 'https://your-mcp-server.com'; // Canonical form

// Authorization request includes resource parameter
const authUrl = await authProvider.getAuthUrl(
  'state-value',
  'https://your-mcp-server.com/auth/callback',
  resourceUri // This binds the token to your MCP server
);

// Token exchange includes resource parameter
const tokens = await authProvider.handleCallback(
  code,
  state,
  'https://your-mcp-server.com/auth/callback',
  resourceUri // Same resource URI
);

// Token refresh includes resource parameter
const newTokens = await authProvider.refreshToken(
  tokens.refreshToken,
  resourceUri // Same resource URI
);
```

### Resource URI Rules (RFC 8707)

```typescript
// ✅ Valid resource URIs
const validUris = [
  'https://mcp.example.com',
  'https://mcp.example.com/server',
  'https://mcp.example.com:8443',
  'http://localhost:3000', // Development only
  'http://127.0.0.1:3000'  // Development only
];

// ❌ Invalid resource URIs
const invalidUris = [
  'mcp.example.com',              // Missing scheme
  'http://mcp.example.com',       // HTTP not allowed in production
  'https://mcp.example.com#frag', // Fragment not allowed
  'https://mcp.example.com/',     // Avoid trailing slash
];
```

## Token Audience Validation

The framework automatically validates token audiences to prevent token reuse attacks:

```typescript
// Audience validation happens automatically in bearer token authentication
class MyBearerAuth extends BearerTokenAuth {
  async verifyToken(token: string, expectedAudience?: string): Promise<User | null> {
    // expectedAudience is automatically extracted from the request
    // e.g., "https://your-mcp-server.com"
    
    if (expectedAudience) {
      // Decode JWT and check audience claim
      const payload = this.decodeJwtPayload(token);
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      
      if (!audiences.includes(expectedAudience)) {
        console.warn(`Token audience mismatch. Expected: ${expectedAudience}`);
        return null; // Reject token
      }
    }
    
    // Verify token with external service
    return await this.verifyWithExternalService(token);
  }
}

// Authentik implementation automatically handles audience validation
const authProvider = new AuthentikAuth(config);

// When a request comes in with a Bearer token:
// Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
// 
// The framework will:
// 1. Extract the token
// 2. Extract expected audience from request: "https://your-mcp-server.com"
// 3. Validate the token's audience claim matches
// 4. Reject tokens issued for other servers
```

## Complete MCP Server Example

Here's a complete example showing all OAuth 2.1 features:

```typescript
import { MCPServer, z } from '@tylercoles/mcp-server';
import { HttpTransport } from '@tylercoles/mcp-transport-http';
import { AuthentikAuth } from '@tylercoles/mcp-auth-authentik';

async function createSecureServer() {
  // Configure OAuth with all security features
  const authProvider = new AuthentikAuth({
    url: process.env.AUTHENTIK_URL!,
    clientId: process.env.AUTHENTIK_CLIENT_ID!,
    clientSecret: process.env.AUTHENTIK_CLIENT_SECRET,
    redirectUri: process.env.OAUTH_REDIRECT_URI!,
    scopes: ['openid', 'profile', 'email'],
    allowedGroups: ['mcp-users'],
    registrationApiToken: process.env.AUTHENTIK_API_TOKEN, // For dynamic registration
  });

  // Create HTTP transport with OAuth
  const transport = new HttpTransport({
    port: parseInt(process.env.PORT || '3000'),
    host: '0.0.0.0',
    auth: authProvider,
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    enableDnsRebindingProtection: true,
    allowedHosts: ['your-mcp-server.com', 'localhost', '127.0.0.1'],
  });

  // Create MCP server
  const server = new MCPServer({
    name: 'secure-mcp-server',
    version: '1.0.0'
  });

  // Add a protected tool
  server.registerTool(
    'get-user-info',
    {
      title: 'Get User Information',
      description: 'Get information about the authenticated user',
      inputSchema: {}
    },
    async (args, context) => {
      // Context automatically includes authenticated user
      const user = context.user;
      
      return {
        content: [{
          type: 'text',
          text: `Hello ${user.username}! You are in groups: ${user.groups.join(', ')}`
        }]
      };
    }
  );

  // Start server
  server.useTransport(transport);
  await server.start();

  console.log('🔐 Secure MCP server started with OAuth 2.1 compliance:');
  console.log('  ✅ PKCE enabled (mandatory)');
  console.log('  ✅ Token audience validation');
  console.log('  ✅ Resource parameter binding');
  console.log('  ✅ HTTPS enforcement');
  console.log('  ✅ Dynamic client registration');
  console.log(`  🌐 Server running on: https://your-mcp-server.com`);
  
  return server;
}

// Environment variables required:
// AUTHENTIK_URL=https://auth.example.com
// AUTHENTIK_CLIENT_ID=your-client-id
// AUTHENTIK_CLIENT_SECRET=your-client-secret (optional for public clients)
// OAUTH_REDIRECT_URI=https://your-mcp-server.com/auth/callback
// AUTHENTIK_API_TOKEN=your-api-token (for dynamic registration)
// ALLOWED_ORIGINS=https://your-client-app.com,https://another-app.com
// PORT=3000

createSecureServer().catch(console.error);
```

### Client-Side OAuth Integration

Here's how a client application would integrate with the MCP server using the OAuth flow:

```typescript
import { AuthentikAuth } from '@tylercoles/mcp-auth-authentik';

class MCPOAuthClient {
  private authProvider: AuthentikAuth;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.authProvider = new AuthentikAuth({
      url: 'https://auth.example.com',
      clientId: 'mcp-client-app',
      redirectUri: `${window.location.origin}/oauth/callback`,
      scopes: ['openid', 'profile', 'email'],
    });
  }

  // Step 1: Initiate OAuth flow
  async startAuth(): Promise<string> {
    const state = this.generateRandomState();
    const redirectUri = `${window.location.origin}/oauth/callback`;
    
    // Store state in session for later validation
    sessionStorage.setItem('oauth_state', state);
    
    // Use convenience method for automatic PKCE handling
    const { authUrl } = await this.authProvider.startOAuthFlow(
      state,
      redirectUri,
      this.baseUrl  // MCP server URL as resource
    );
    
    return authUrl;
  }

  // Step 2: Handle OAuth callback
  async handleCallback(code: string, returnedState: string): Promise<string> {
    const expectedState = sessionStorage.getItem('oauth_state');
    
    if (expectedState !== returnedState) {
      throw new Error('Invalid OAuth state parameter');
    }
    
    const redirectUri = `${window.location.origin}/oauth/callback`;
    
    // Complete OAuth flow with stored PKCE parameters
    const tokens = await this.authProvider.completeOAuthFlow(
      code,
      returnedState,
      redirectUri,
      this.baseUrl
    );
    
    // Store access token for API calls
    sessionStorage.setItem('access_token', tokens.accessToken);
    sessionStorage.removeItem('oauth_state');
    
    return tokens.accessToken;
  }

  // Step 3: Make authenticated API calls to MCP server
  async callMCPTool(toolName: string, args: any): Promise<any> {
    const accessToken = sessionStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('No access token available. Please authenticate first.');
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      })
    });

    if (!response.ok) {
      throw new Error(`MCP call failed: ${response.statusText}`);
    }

    return response.json();
  }

  private generateRandomState(): string {
    return crypto.getRandomValues(new Uint32Array(4)).join('-');
  }
}

// Usage in a web application
const mcpClient = new MCPOAuthClient('https://your-mcp-server.com');

// When user clicks "Sign In"
document.getElementById('signin')?.addEventListener('click', async () => {
  try {
    const authUrl = await mcpClient.startAuth();
    window.location.href = authUrl;  // Redirect to OAuth provider
  } catch (error) {
    console.error('Failed to start OAuth flow:', error);
  }
});

// On OAuth callback page
if (window.location.pathname === '/oauth/callback') {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  
  if (code && state) {
    mcpClient.handleCallback(code, state)
      .then(() => {
        console.log('Authentication successful!');
        window.location.href = '/dashboard';  // Redirect to app
      })
      .catch(error => {
        console.error('OAuth callback failed:', error);
      });
  }
}

// Making MCP calls after authentication
async function getUserInfo() {
  try {
    const result = await mcpClient.callMCPTool('get-user-info', {});
    console.log('User info:', result.result.content[0].text);
  } catch (error) {
    console.error('Failed to get user info:', error);
  }
}
```

## Security Best Practices

### 1. Always Use Resource Parameters
```typescript
// ✅ Good: Bind tokens to your MCP server
const authUrl = await authProvider.getAuthUrl(
  state,
  redirectUri,
  'https://your-mcp-server.com' // Resource binding
);

// ❌ Bad: No resource binding (tokens could be reused)
const authUrl = await authProvider.getAuthUrl(state, redirectUri);
```

### 2. Validate Token Audiences
```typescript
// ✅ Good: Framework automatically validates audiences
const user = await authProvider.verifyToken(token, expectedAudience);

// ❌ Bad: Accepting tokens without audience validation
const user = await authProvider.verifyToken(token); // Missing audience check
```

### 3. Use HTTPS in Production
```typescript
// ✅ Good: HTTPS enforcement enabled
const transport = new HttpTransport({
  enableDnsRebindingProtection: true,
  allowedHosts: ['your-secure-domain.com']
});

// ❌ Bad: Allowing HTTP in production
const transport = new HttpTransport({
  enableDnsRebindingProtection: false // Insecure
});
```

### 4. Restrict User Access
```typescript
// ✅ Good: Limit access to specific groups
const authProvider = new AuthentikAuth({
  allowedGroups: ['mcp-users', 'admin'], // Only these groups can access
  // ...other config
});

// ⚠️ Caution: No group restrictions (all authenticated users allowed)
const authProvider = new AuthentikAuth({
  // allowedGroups not specified
  // ...other config
});
```

## Troubleshooting

### Common Issues

1. **PKCE Validation Failed**
   ```
   Error: Invalid PKCE code verifier
   ```
   - Ensure you're using the same auth provider instance for the entire flow
   - Don't manually generate PKCE parameters; let the framework handle it

2. **Token Audience Mismatch**
   ```
   Error: Token audience mismatch. Expected: https://server.com, Got: https://other.com
   ```
   - Ensure the resource parameter matches your MCP server's canonical URI
   - Check that the token was issued for your server, not another

3. **HTTPS Validation Failed**
   ```
   Error: Authorization endpoint must use HTTPS in production
   ```
   - Ensure all OAuth endpoints use HTTPS in production
   - Use `allowLocalhost: true` for development environments

4. **Invalid Resource URI**
   ```
   Error: Invalid resource URI format
   ```
   - Use canonical URI format: `https://domain.com` (no trailing slash)
   - Don't include fragments or query parameters
   - Use HTTPS except for localhost development

## Migration from Basic OAuth

If you're upgrading from a basic OAuth implementation:

```typescript
// Before: Basic OAuth (insecure)
const authUrl = await provider.getAuthUrl(state, redirectUri);
const tokens = await provider.handleCallback(code, state, redirectUri);

// After: OAuth 2.1 compliant (secure)
const resourceUri = 'https://your-mcp-server.com';
const authUrl = await provider.getAuthUrl(state, redirectUri, resourceUri);
const tokens = await provider.handleCallback(code, state, redirectUri, resourceUri);
```

The framework automatically adds:
- ✅ PKCE parameters (`code_challenge`, `code_challenge_method`, `code_verifier`)
- ✅ Resource parameter for token binding
- ✅ HTTPS validation for all endpoints
- ✅ Token audience validation

No manual changes needed - just update your method calls to include the resource parameter!
