# Contributing to MCP Framework

Thank you for your interest in contributing to the MCP Framework! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please treat all contributors and users with respect.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Git

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/mcp-framework.git
   cd mcp-framework
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build all packages**
   ```bash
   npm run build
   ```

4. **Run tests to ensure everything works**
   ```bash
   npm test
   ```

5. **Start development mode**
   ```bash
   npm run dev
   ```

## Development Workflow

### Project Structure

```
mcp-framework/
├── packages/           # Core packages
├── examples/           # Example implementations
├── docs/              # Documentation
├── tools/             # Build and development tools
├── spec/              # MCP specification
└── tests/             # Integration tests
```

### npm Workspaces

This project uses npm workspaces for managing multiple packages:

```bash
# Install dependency in specific package
npm install express -w @tylercoles/mcp-transport-http

# Build specific package
npm run build -w @tylercoles/mcp-server

# Test specific package
npm test -w @tylercoles/mcp-server

# Run specific package in dev mode
npm run dev -w @tylercoles/mcp-server
```

### Common Commands

```bash
# Build all packages
npm run build

# Build in dependency order (if build fails)
npm run build:order

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Type checking
npm run typecheck

# Lint all packages
npm run lint

# Clean build artifacts
npm run clean

# Verify workspace configuration
npm run verify

# Security audit
npm run security:audit
```

## Making Changes

### Before You Start

1. **Check existing issues** to see if your feature/bug is already being worked on
2. **Create an issue** to discuss your proposed changes
3. **Get feedback** from maintainers before starting significant work

### Branch Naming

Use descriptive branch names:
- `feature/add-grpc-transport`
- `fix/oauth-token-refresh`
- `docs/update-getting-started`
- `refactor/simplify-auth-interface`

### Development Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm test
   npm run typecheck
   npm run lint
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

5. **Push and create a pull request**
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Style

### TypeScript Guidelines

- Use TypeScript for all new code
- Prefer interfaces over types for object shapes
- Use proper type annotations
- Avoid `any` type - use proper typing

```typescript
// ✅ Good
interface ToolConfig {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

// ❌ Bad  
const toolConfig: any = {
  name: 'example',
  description: 'Example tool'
};
```

### Code Organization

- Keep functions small and focused
- Use descriptive variable and function names
- Group related functionality together
- Export only what's needed

```typescript
// ✅ Good
export class HttpTransport implements Transport {
  private server: Server;
  private authProvider?: AuthProvider;

  constructor(config: HttpTransportConfig) {
    this.validateConfig(config);
    this.server = this.createServer(config);
  }

  private validateConfig(config: HttpTransportConfig): void {
    // Validation logic
  }

  private createServer(config: HttpTransportConfig): Server {
    // Server creation logic
  }
}
```

### Error Handling

- Use proper error types
- Provide meaningful error messages
- Don't expose internal implementation details

```typescript
// ✅ Good
if (!user.hasPermission('admin')) {
  throw new AuthenticationError('Insufficient permissions');
}

// ❌ Bad
if (!user.hasPermission('admin')) {
  throw new Error('Database query failed: SELECT * FROM users WHERE...');
}
```

## Testing

### Test Structure

- Tests are located in `tests/` directories within each package
- Use Vitest for testing
- Aim for 80%+ code coverage
- Test both success and error cases

### Test Naming

```typescript
// ✅ Good
describe('HttpTransport', () => {
  describe('constructor', () => {
    it('should create server with valid config', () => {
      // Test implementation
    });

    it('should throw error with invalid config', () => {
      // Test implementation
    });
  });
});
```

### Test Types

1. **Unit Tests**: Test individual functions/classes
2. **Integration Tests**: Test component interactions
3. **End-to-End Tests**: Test full workflows

### Running Tests

```bash
# Run all tests
npm test

# Run specific package tests
npm test -w @tylercoles/mcp-server

# Run tests in watch mode (in package directory)
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Documentation

### Code Documentation

- Use JSDoc comments for public APIs
- Include examples where helpful
- Document complex logic

```typescript
/**
 * Creates a new MCP server instance
 * @param config - Server configuration
 * @returns Configured MCPServer instance
 * @example
 * ```typescript
 * const server = new MCPServer({
 *   name: 'my-server',
 *   version: '1.0.0'
 * });
 * ```
 */
export class MCPServer {
  constructor(config: MCPServerConfig) {
    // Implementation
  }
}
```

### README Updates

- Update package READMEs when adding features
- Include usage examples
- Update main README for architectural changes

### Documentation Files

- Create documentation in `docs/` folder
- Use Markdown format
- Include code examples
- Keep documentation up-to-date

## Submitting Changes

### Pull Request Process

1. **Ensure tests pass**
   ```bash
   npm test
   npm run typecheck
   npm run lint
   ```

2. **Update documentation** if needed

3. **Create a pull request** with:
   - Clear description of changes
   - Link to related issues
   - Testing instructions
   - Breaking change notes (if any)

### Pull Request Template

```markdown
## Description
Brief description of changes

## Related Issues
Closes #123

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

### Review Process

1. **Automated checks** must pass (CI/CD)
2. **Code review** by maintainers
3. **Testing** in different environments
4. **Documentation review** if applicable
5. **Final approval** and merge

## Adding New Packages

### Package Structure

```
packages/new-package/
├── src/
│   └── index.ts
├── tests/
│   └── index.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Package Configuration

1. **package.json**
   ```json
   {
     "name": "@tylercoles/mcp-new-package",
     "version": "0.2.1",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "test": "vitest",
       "dev": "tsc --watch"
     }
   }
   ```

2. **tsconfig.json**
   ```json
   {
     "extends": "../../tsconfig.json",
     "compilerOptions": {
       "outDir": "dist",
       "rootDir": "src"
     },
     "include": ["src/**/*"],
     "exclude": ["dist", "tests"]
   }
   ```

3. **vitest.config.ts**
   ```typescript
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     test: {
       environment: 'node',
       coverage: {
         reporter: ['text', 'json', 'html'],
         threshold: {
           branches: 80,
           functions: 80,
           lines: 80,
           statements: 80
         }
       }
     }
   });
   ```

## Release Process

### Version Management

- We use semantic versioning (semver)
- All packages are released together
- Version bumps are coordinated across packages

### Release Types

- **Patch** (0.2.1): Bug fixes
- **Minor** (0.3.0): New features, backwards compatible
- **Major** (1.0.0): Breaking changes

### Pre-release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version numbers updated
- [ ] Security audit passed
- [ ] Breaking changes documented

## Support

### Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community discussion
- **Documentation**: Check `docs/` folder and package READMEs

### Reporting Issues

When reporting bugs, please include:
- Operating system and version
- Node.js version
- Framework version
- Steps to reproduce
- Expected vs actual behavior
- Code samples (if applicable)

### Feature Requests

When requesting features:
- Check existing issues first
- Describe the use case
- Explain why it's needed
- Provide examples if possible

## Recognition

Contributors are recognized in:
- `CONTRIBUTORS.md` file
- Release notes
- GitHub contributors page

Thank you for contributing to the MCP Framework!