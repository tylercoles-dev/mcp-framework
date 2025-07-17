# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| 0.1.x   | :x:                |

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** create a public issue
2. Email security reports to: [security@tylercoles.dev](mailto:security@tylercoles.dev)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Affected versions
   - Any potential impact assessment

We will respond within 48 hours and work with you to resolve the issue.

## Security Features

### Authentication & Authorization

#### OAuth 2.1 Compliance
- **PKCE (Proof Key for Code Exchange)**: Required for all OAuth flows
- **Dynamic Client Registration**: Secure client registration with proper validation
- **Secure Token Storage**: Tokens are stored securely with appropriate expiration
- **State Parameter**: CSRF protection in OAuth flows

#### Session Management
- **Secure Cookies**: HttpOnly, Secure, SameSite attributes
- **Session Rotation**: Automatic session ID rotation
- **Configurable Expiration**: Customizable session timeouts
- **Cross-Site Protection**: CSRF token validation

### Transport Security

#### HTTP Transport
- **HTTPS Enforcement**: Production deployments should use HTTPS
- **Security Headers**: Helmet.js integration for security headers
- **CORS Protection**: Configurable CORS policies
- **Rate Limiting**: Built-in rate limiting to prevent abuse

#### WebSocket Transport
- **WSS Support**: WebSocket Secure (WSS) for encrypted connections
- **Origin Validation**: Configurable origin checking
- **Connection Limits**: Configurable connection limits per client

### Input Validation

#### Zod Schemas
- **Strict Validation**: All inputs validated against Zod schemas
- **Type Safety**: Runtime type checking for all parameters
- **Sanitization**: Automatic sanitization of user inputs

#### Request Validation
- **Content-Type Validation**: Strict content-type checking
- **Size Limits**: Configurable request size limits
- **Encoding Validation**: Proper encoding validation

### Error Handling

#### Secure Error Messages
- **No Information Leakage**: Error messages don't expose internal details
- **Structured Logging**: Comprehensive logging without sensitive data
- **Rate Limited Errors**: Error responses are rate limited

### Dependencies

#### Security Auditing
- **npm audit**: Regular dependency vulnerability scanning
- **Automated Updates**: Dependabot for security updates
- **Minimal Dependencies**: Reduced attack surface through minimal dependencies

## Security Best Practices

### For Developers

#### Code Security
```typescript
// ✅ Good: Validate all inputs
server.addTool({
  name: 'example',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 1000 }
    },
    required: ['query']
  }
}, async (params) => {
  // Input is already validated by the framework
  return await safeOperation(params.query);
});

// ❌ Bad: No input validation
server.addTool({
  name: 'example'
}, async (params) => {
  // params could be anything - security risk
  return await operation(params.query);
});
```

#### Authentication Context
```typescript
// ✅ Good: Use context for authorization
server.addTool({
  name: 'admin-tool',
  inputSchema: { /* ... */ }
}, async (params, context) => {
  if (!context.user?.roles?.includes('admin')) {
    throw new Error('Insufficient permissions');
  }
  return await adminOperation(params);
});

// ❌ Bad: No authorization check
server.addTool({
  name: 'admin-tool',
  inputSchema: { /* ... */ }
}, async (params) => {
  // Anyone can call this - security risk
  return await adminOperation(params);
});
```

### For Deployment

#### Environment Configuration
```bash
# ✅ Required security environment variables
NODE_ENV=production
HTTPS_ENABLED=true
OAUTH_CLIENT_SECRET=your-secure-secret
SESSION_SECRET=your-session-secret
RATE_LIMIT_ENABLED=true
CORS_ORIGINS=https://your-domain.com

# ❌ Avoid in production
NODE_ENV=development
HTTPS_ENABLED=false
DEBUG=true
```

#### HTTPS Configuration
```typescript
// ✅ Good: Force HTTPS in production
const httpTransport = new HttpTransport({
  port: 3000,
  httpsOptions: {
    key: fs.readFileSync('path/to/private-key.pem'),
    cert: fs.readFileSync('path/to/certificate.pem')
  },
  cors: {
    origin: ['https://your-domain.com'],
    credentials: true
  }
});
```

### Docker Security

#### Container Security
```dockerfile
# ✅ Good: Use non-root user
FROM node:18-alpine
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcp -u 1001
USER mcp

# ✅ Good: Minimal attack surface
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcp -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=mcp:nodejs . .
USER mcp
```

## Security Checklist

### Pre-Deployment
- [ ] All dependencies updated and audited
- [ ] HTTPS enabled for production
- [ ] OAuth client secrets properly configured
- [ ] Session secrets are cryptographically secure
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Input validation schemas in place
- [ ] Error handling doesn't leak information
- [ ] Logging excludes sensitive data

### Runtime Security
- [ ] Monitor for unusual request patterns
- [ ] Regular security audits
- [ ] Keep dependencies updated
- [ ] Monitor authentication failures
- [ ] Regular credential rotation
- [ ] Backup and recovery procedures tested

## Known Security Considerations

### Transport-Specific

#### stdio Transport
- **Local Access Only**: stdio transport should only be used for local development
- **Process Isolation**: Ensure proper process isolation when using stdio
- **Command Injection**: Be careful with shell command execution

#### HTTP Transport
- **Session Fixation**: Sessions are properly rotated
- **CSRF Protection**: Built-in CSRF protection for state-changing operations
- **SQL Injection**: Use parameterized queries in tools

#### WebSocket Transport
- **Connection Limits**: Implement connection limits to prevent DoS
- **Message Size Limits**: Enforce maximum message sizes
- **Ping/Pong Handling**: Proper handling of ping/pong frames

### Authentication Providers

#### Authentik
- **Token Validation**: Proper JWT token validation
- **Scope Validation**: Ensure proper scope validation
- **Refresh Token Security**: Secure refresh token handling

#### OIDC
- **Issuer Validation**: Proper issuer validation
- **Nonce Validation**: Proper nonce handling
- **Clock Skew**: Handle clock skew in token validation

## Incident Response

In case of a security incident:

1. **Immediate Response**
   - Assess the scope and impact
   - Contain the incident
   - Preserve evidence

2. **Investigation**
   - Analyze logs and system state
   - Identify root cause
   - Document timeline

3. **Recovery**
   - Apply security patches
   - Rotate compromised credentials
   - Update security measures

4. **Communication**
   - Notify affected users
   - Provide status updates
   - Document lessons learned

## Security Updates

Security updates are released as needed and will be clearly marked in release notes. Subscribe to our security advisories:

- GitHub Security Advisories: [Repository Security](https://github.com/tylercoles-dev/mcp-framework/security)
- Release Notes: [GitHub Releases](https://github.com/tylercoles-dev/mcp-framework/releases)

For questions about security, contact: [security@tylercoles.dev](mailto:security@tylercoles.dev)