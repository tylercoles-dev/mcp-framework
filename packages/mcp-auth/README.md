# @tylercoles/mcp-auth

Authentication abstractions and providers for MCP servers. This package provides a pluggable authentication system with support for various authentication methods including OAuth2, bearer tokens, sessions, and development testing.

## Features

- 🔐 **Multiple Auth Methods** - OAuth2, Bearer Token, Session-based, and development auth
- 🌐 **MCP Compliance** - Full support for MCP authorization specification (RFC 9728)
- 🔌 **Pluggable Architecture** - Easy to extend with custom auth providers
- 🛡️ **Security Best Practices** - Built-in PKCE, CSRF protection, and secure defaults
- 🧪 **Development Friendly** - Mock auth providers for testing and development

## Installation

```bash
npm install @tylercoles/mcp-auth
```

## Quick Start

```typescript
import { AuthProvider, DevAuth, createAuthMiddleware } from '@tylercoles/mcp-auth';
import express from 'express';

const app = express();

// Use development auth for testing
const authProvider = new DevAuth({
  id: 'dev-user',
  username: 'developer',
  email: 'dev@example.com',
  groups: ['developers']
});

// Apply auth middleware
app.use('/protected', createAuthMiddleware(authProvider));

app.get('/protected/data', (req, res) => {
  const user = (req as any).user;
  res.json({ message: `Hello ${user.username}!`, user });
});
```

## Authentication Providers

### DevAuth - Development Testing

Perfect for development and testing:

```typescript
import { DevAuth } from '@tylercoles/mcp-auth';

const auth = new DevAuth({
  id: 'test-user',
  username: 'testuser',
  email: 'test@example.com',
  groups: ['testers', 'developers']
});
```

### NoAuth - No Authentication

Disables authentication entirely:

```typescript
import { NoAuth } from '@tylercoles/mcp-auth';

const auth = new NoAuth(); // Always returns null user
```

### BearerTokenAuth - API Token Authentication

Abstract class for implementing bearer token authentication:

```typescript
import { BearerTokenAuth, User } from '@tylercoles/mcp-auth';

class APIKeyAuth extends BearerTokenAuth {
  async verifyToken(token: string): Promise<User | null> {
    // Verify token against your database/service
    const user = await getUserFromToken(token);
    return user ? {
      id: user.id,
      username: user.username,
      email: user.email,
      groups: user.roles
    } : null;
  }
}
```

### SessionAuth - Session-based Authentication

Abstract class for session-based authentication:

```typescript
import { SessionAuth, User } from '@tylercoles/mcp-auth';

class SessionProvider extends SessionAuth {
  async authenticate(req: Request): Promise<User | null> {
    // Session data is typically set by passport or similar
    return req.session?.user || null;
  }
  
  getUser(req: Request): User | null {
    return req.session?.user || null;
  }
}
```

### OAuthProvider - OAuth2/OIDC Authentication

Abstract class for OAuth2 providers with full MCP compliance:

```typescript
import { OAuthProvider } from '@tylercoles/mcp-auth';

class CustomOAuthProvider extends OAuthProvider {
  async getAuthUrl(state?: string, redirectUri?: string): Promise<string> {
    // Return authorization URL
  }
  
  async handleCallback(code: string, state?: string): Promise<TokenResult> {
    // Exchange code for tokens
  }
  
  async verifyToken(token: string): Promise<User | null> {
    // Verify access token
  }
  
  getDiscoveryMetadata(baseUrl: string): OAuthDiscovery {
    // Return OAuth discovery metadata
  }
  
  getProtectedResourceMetadata(baseUrl: string): ProtectedResourceMetadata {
    // Return protected resource metadata for MCP compliance
  }
}
```

## MCP Authorization Compliance

This package fully supports the MCP authorization specification:

### Discovery Endpoints

```typescript
import { createOAuthDiscoveryRoutes } from '@tylercoles/mcp-auth';

const router = createOAuthDiscoveryRoutes(oauthProvider);
app.use(router);
```

This automatically sets up:
- `/.well-known/oauth-protected-resource` - Protected resource metadata (RFC 9728)
- `/.well-known/oauth-authorization-server` - OAuth server metadata (RFC 8414)
- `/application/o/register/` - Dynamic client registration (if supported)

### Protected Resource Metadata

For MCP servers, return appropriate metadata:

```typescript
{
  "resource": "https://mcp.example.com",
  "authorization_servers": ["https://auth.example.com"]
}
```

## Middleware Integration

### Express Middleware

```typescript
import { createAuthMiddleware } from '@tylercoles/mcp-auth';

const authMiddleware = createAuthMiddleware(authProvider);

// Apply to specific routes
app.use('/api', authMiddleware);

// Or selectively
app.get('/public', handler);
app.get('/private', authMiddleware, privateHandler);
```

### Custom Middleware

```typescript
app.use(async (req, res, next) => {
  const user = await authProvider.authenticate(req);
  if (user) {
    (req as any).user = user;
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});
```

## User Interface

All auth providers work with a standard user interface:

```typescript
interface User {
  id: string;           // Unique user identifier
  username: string;     // Display name/username
  email: string;        // User email
  groups: string[];     // User groups/roles
  [key: string]: any;   // Additional user properties
}
```

## Utilities

### Token Extraction

```typescript
import { extractBearerToken } from '@tylercoles/mcp-auth';

const token = extractBearerToken(req); // Returns token or null
```

### Base URL Helper

```typescript
function getBaseUrl(req: Request): string {
  return `${req.protocol}://${req.get('host')}`;
}
```

## Security Considerations

- **Token Storage**: Never store tokens in localStorage, use secure HTTP-only cookies
- **HTTPS**: Always use HTTPS in production for token transmission
- **CSRF Protection**: Use CSRF tokens for session-based authentication
- **Token Validation**: Always validate tokens on every request
- **Scope Limitation**: Implement proper scope/permission checking

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type { 
  User, 
  AuthProvider, 
  OAuthProvider,
  TokenResult,
  OAuthDiscovery 
} from '@tylercoles/mcp-auth';
```

## Integration with MCP Transports

Works seamlessly with MCP transport packages:

```typescript
import { HttpTransport } from '@tylercoles/mcp-transport-http';
import { DevAuth } from '@tylercoles/mcp-auth';

const transport = new HttpTransport({
  port: 3000,
  auth: new DevAuth()
});
```

## Examples

See the [examples directory](../../examples) for complete implementation examples:
- Basic authentication setup
- OAuth2 integration
- Multi-provider authentication
- Custom auth provider implementation

## License

MIT
