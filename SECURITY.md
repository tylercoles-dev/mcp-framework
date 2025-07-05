# Security Guidelines

## Overview

This document outlines security best practices for the MCP Framework.

## Sensitive Information

### What NOT to Commit

Never commit the following to the repository:

- **Environment files** (`.env`, `.env.local`, etc.)
- **Private keys** or certificates
- **API keys** and secrets
- **Database credentials**
- **OAuth client secrets**
- **Personal access tokens**
- **Production URLs** with embedded credentials

### Environment Variables

All sensitive configuration should use environment variables:

```bash
# Good - using environment variables
AUTHENTIK_CLIENT_SECRET=your-secret-here

# Bad - hardcoding secrets
const clientSecret = "actual-secret-value";
```

### Example Files

Always provide `.env.example` files with placeholder values:

```bash
# .env.example
SESSION_SECRET=your-session-secret-here-minimum-32-chars
AUTHENTIK_CLIENT_SECRET=your-client-secret
```

## Authentication & Authorization

### OAuth Configuration

1. **Client Secrets**: Always use environment variables
2. **Redirect URIs**: Use configurable base URLs
3. **Allowed Groups**: Implement proper access control
4. **Token Storage**: Never log or expose tokens

### Session Security

- Use strong session secrets (32+ characters)
- Enable HTTPS in production
- Set secure cookie flags
- Implement CSRF protection

## Transport Security

### HTTP Transport

- Always use HTTPS in production
- Enable CORS with specific origins
- Implement rate limiting
- Use security headers (Helmet)

### DNS Rebinding Protection

The HTTP transport includes DNS rebinding protection:

```typescript
const transport = new HttpTransport({
  enableDnsRebindingProtection: true,
  allowedHosts: ['127.0.0.1', 'localhost']
});
```

## Development Security

### Test Data

- Use obvious test values (`test-token`, `test-secret`)
- Never use real credentials in tests
- Mock external services

### Local Development

- Use localhost for development
- Keep development and production configs separate
- Use different OAuth apps for dev/prod

## Security Checklist

Before committing:

- [ ] Run `npm run security:audit`
- [ ] Check no `.env` files are staged
- [ ] Verify no secrets in code
- [ ] Ensure test data is clearly fake
- [ ] Review changed files for sensitive data

## Running Security Audit

```bash
# Run security audit
npm run security:audit

# This checks for:
# - Hardcoded passwords/secrets
# - API keys
# - Private keys
# - Email addresses
# - URLs with credentials
```

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. Email the maintainers privately
3. Include:
   - Description of the issue
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Dependencies

- Regularly update dependencies: `npm update`
- Check for vulnerabilities: `npm audit`
- Fix vulnerabilities: `npm audit fix`

## Production Deployment

### Required Environment Variables

```bash
# Security
SESSION_SECRET=<strong-random-string>
NODE_ENV=production

# OAuth (if using)
AUTHENTIK_CLIENT_SECRET=<from-authentik>
AUTHENTIK_URL=<your-authentik-instance>

# CORS
CORS_ORIGINS=https://your-domain.com
```

### Security Headers

The framework automatically includes security headers via Helmet:

- Content Security Policy
- X-DNS-Prefetch-Control
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security (HTTPS)

### Access Control

- Implement proper group-based access
- Validate all user inputs
- Use parameterized queries
- Implement rate limiting

## Token Security

### MCP Protocol

- Tokens must be validated on every request
- Implement token expiration
- Never log token values
- Use secure token storage

### OAuth Tokens

- Validate token audience
- Check token expiration
- Implement token refresh
- Revoke tokens on logout

## Best Practices

1. **Principle of Least Privilege**: Grant minimum required permissions
2. **Defense in Depth**: Multiple security layers
3. **Fail Securely**: Errors shouldn't expose sensitive info
4. **Keep It Simple**: Complex security often fails
5. **Stay Updated**: Keep dependencies current

## Additional Resources

- [OWASP Top Ten](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [npm Security Best Practices](https://docs.npmjs.com/packages-and-modules/securing-your-code)
