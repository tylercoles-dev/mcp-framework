# @tylercoles/mcp-auth-oidc

A generic OpenID Connect (OIDC) authentication provider for MCP servers. This package provides a flexible, standards-compliant OIDC authentication implementation that can work with any OIDC-compatible identity provider.

## Features

- **Universal OIDC Support**: Works with any OIDC-compliant identity provider
- **Automatic Discovery**: Supports OIDC discovery documents or manual configuration
- **Flexible Claims Mapping**: Configurable mapping of OIDC claims to user attributes
- **Multiple Auth Methods**: Support for various client authentication methods
- **PKCE Support**: OAuth 2.1 compliant with PKCE for enhanced security
- **Pre-configured Providers**: Built-in support for popular providers (Auth0, Okta, Keycloak, Google, Microsoft)
- **Dynamic Registration**: Support for OAuth dynamic client registration
- **Token Management**: Full token lifecycle management (issue, refresh, revoke)
- **Group-based Access Control**: Optional group restrictions for access control

## Installation

```bash
npm install @tylercoles/mcp-auth-oidc
```

## Quick Start

### Using Discovery URL

```typescript
import { OIDCProvider } from '@tylercoles/mcp-auth-oidc';

const provider = new OIDCProvider({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://your-app.com/callback',
  discoveryUrl: 'https://your-provider.com/.well-known/openid-configuration'
});

await provider.initialize();
```

### Manual Configuration

```typescript
import { OIDCProvider } from '@tylercoles/mcp-auth-oidc';

const provider = new OIDCProvider({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://your-app.com/callback',
  issuer: 'https://your-provider.com',
  authorizationEndpoint: 'https://your-provider.com/auth',
  tokenEndpoint: 'https://your-provider.com/token',
  userinfoEndpoint: 'https://your-provider.com/userinfo',
  jwksUri: 'https://your-provider.com/.well-known/jwks.json'
});

await provider.initialize();
```

## Pre-configured Providers

The package includes pre-configured providers for popular OIDC services:

### Auth0

```typescript
import { Providers } from '@tylercoles/mcp-auth-oidc';

const auth0 = Providers.Auth0('your-domain.auth0.com', 'client-id', 'client-secret');
```

### Okta

```typescript
import { Providers } from '@tylercoles/mcp-auth-oidc';

const okta = Providers.Okta('your-domain.okta.com', 'client-id', 'client-secret');
```

### Keycloak

```typescript
import { Providers } from '@tylercoles/mcp-auth-oidc';

const keycloak = Providers.Keycloak(
  'https://keycloak.example.com', 
  'your-realm', 
  'client-id', 
  'client-secret'
);
```

### Google

```typescript
import { Providers } from '@tylercoles/mcp-auth-oidc';

const google = Providers.Google('client-id', 'client-secret');
```

### Microsoft/Azure AD

```typescript
import { Providers } from '@tylercoles/mcp-auth-oidc';

const microsoft = Providers.Microsoft('tenant-id', 'client-id', 'client-secret');
```

## Advanced Configuration

### Custom Claims Mapping

```typescript
const provider = new OIDCProvider({
  clientId: 'client-id',
  discoveryUrl: 'https://provider.com/.well-known/openid-configuration',
  
  // Custom claim mappings
  idClaim: 'user_id',        // Default: 'sub'
  usernameClaim: 'login',    // Default: 'preferred_username'
  emailClaim: 'mail',        // Default: 'email'
  groupsClaim: 'roles',      // Default: 'groups'
  
  // Access control
  allowedGroups: ['admin', 'users'],
});
```

### Token Authentication Methods

```typescript
const provider = new OIDCProvider({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  discoveryUrl: 'https://provider.com/.well-known/openid-configuration',
  
  // Client authentication method
  tokenEndpointAuthMethod: 'client_secret_basic', // or 'client_secret_post', 'none'
  
  // Token validation
  validateAudience: true,
  expectedAudience: 'https://your-api.com',
  validateIssuer: true,
  clockTolerance: 60, // seconds
});
```

### Using ID Tokens

```typescript
const provider = new OIDCProvider({
  clientId: 'client-id',
  discoveryUrl: 'https://provider.com/.well-known/openid-configuration',
  
  // Use ID token for user info instead of userinfo endpoint
  useIdToken: true,
});
```

## Usage with MCP Server

```typescript
import { MCPServer } from '@tylercoles/mcp-server';
import { HTTPTransport } from '@tylercoles/mcp-transport-http';
import { OIDCProvider } from '@tylercoles/mcp-auth-oidc';

const server = new MCPServer({
  name: 'my-server',
  version: '1.0.0',
});

const oidcProvider = new OIDCProvider({
  clientId: process.env.OIDC_CLIENT_ID!,
  clientSecret: process.env.OIDC_CLIENT_SECRET!,
  discoveryUrl: process.env.OIDC_DISCOVERY_URL!,
  redirectUri: process.env.OIDC_REDIRECT_URI!,
});

await oidcProvider.initialize();

const httpTransport = new HTTPTransport({
  port: 3000,
  authProvider: oidcProvider,
});

server.useTransport(httpTransport);
```

## API Reference

### Configuration Options

```typescript
interface OIDCConfig {
  // Discovery or manual configuration
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
  idClaim?: string;
  usernameClaim?: string;
  emailClaim?: string;
  nameClaim?: string;
  groupsClaim?: string;
  
  // Access control
  allowedGroups?: string[];
  
  // Advanced options
  tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post' | 'none';
  useIdToken?: boolean;
  additionalAuthParams?: Record<string, string>;
}
```

### Main Methods

- `initialize()`: Initialize the provider and fetch discovery document
- `getAuthUrl(state?, redirectUri?, resource?, pkceParams?)`: Generate authorization URL
- `handleCallback(code, state?, redirectUri?, resource?, codeVerifier?)`: Exchange authorization code for tokens
- `verifyToken(token, expectedAudience?)`: Verify access token and get user info
- `refreshToken(refreshToken, resource?)`: Refresh access token
- `revokeToken(token, tokenType?)`: Revoke access or refresh token
- `authenticate(req)`: Authenticate HTTP request
- `registerClient(request)`: Register client dynamically (if supported)

## Security Features

- **HTTPS Enforcement**: Validates HTTPS endpoints in production
- **PKCE Support**: Implements Proof Key for Code Exchange
- **Token Validation**: Comprehensive JWT validation with configurable options
- **Audience Validation**: Ensures tokens are intended for your application
- **Issuer Validation**: Verifies token issuer matches expected provider
- **Clock Tolerance**: Handles clock skew in token validation

## Error Handling

The provider follows OAuth 2.1 error handling standards and returns appropriate error responses:

```typescript
try {
  const tokens = await provider.handleCallback(code);
} catch (error) {
  if (error.oauthError) {
    // OAuth-compliant error
    console.error('OAuth Error:', error.oauthError.error);
    console.error('Description:', error.oauthError.error_description);
  } else {
    // Generic error
    console.error('Error:', error.message);
  }
}
```

## Testing

Run tests with:

```bash
npm test
```

## Contributing

Contributions are welcome! Please read the contributing guidelines and ensure all tests pass.

## License

MIT License - see LICENSE file for details.