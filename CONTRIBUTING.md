# Contributing to MCP Framework

Thank you for your interest in contributing to the MCP Framework! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to the Contributor Covenant [code of conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the maintainers.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Create a new branch for your feature or fix
4. Make your changes
5. Push to your fork and submit a pull request

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm 7 or higher (for workspace support)
- Git

### Initial Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/mcp-framework.git
cd mcp-framework

# Add upstream remote
git remote add upstream https://github.com/tylercoles-dev/mcp-framework

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests to ensure everything works
npm test

# Verify workspace setup
npm run verify
```

### Development Workflow

```bash
# Create a new branch
git checkout -b feature/my-feature

# Make changes and test
npm run dev          # Watch mode for all packages
npm test            # Run all tests
npm run lint        # Check code style

# Test specific package
npm run test -w @tylercoles/mcp-server

# Build specific package
npm run build -w @tylercoles/mcp-auth
```

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- System information (OS, Node.js version, npm version)
- Relevant logs or error messages

### Suggesting Features

Feature requests are welcome! Please provide:

- A clear and descriptive title
- Detailed description of the proposed feature
- Use cases and examples
- Any potential implementation ideas

### Submitting Changes

1. **Small Changes**: For small changes (typos, minor fixes), you can submit a PR directly.

2. **Large Changes**: For significant changes, please open an issue first to discuss the approach.

3. **New Features**: Always discuss new features in an issue before implementation.

## Pull Request Process

### Before Submitting

1. **Update from upstream**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**
   ```bash
   npm run build
   npm test
   npm run lint
   npm run typecheck
   npm run security:audit
   ```

3. **Update documentation**
   - Update README.md if needed
   - Add JSDoc comments for new functions
   - Update CHANGELOG.md

4. **Write tests**
   - All new features must have tests
   - Maintain or improve code coverage
   - Run `npm run test:coverage`

### PR Guidelines

- **Title**: Use conventional commit format (e.g., `feat: add new transport`, `fix: handle connection errors`)
- **Description**: Clearly describe what changes you made and why
- **Breaking Changes**: Clearly mark any breaking changes
- **Issues**: Reference any related issues (e.g., "Fixes #123")

### Review Process

1. At least one maintainer must review the PR
2. All CI checks must pass
3. Code coverage must not decrease significantly
4. No merge conflicts

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Provide type definitions for all exports
- Avoid `any` types

### Code Style

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Maximum line length: 100 characters

Example:
```typescript
export class MyClass {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async process(data: string): Promise<Result> {
    // Implementation
  }
}
```

### Naming Conventions

- **Classes**: PascalCase (e.g., `McpServer`)
- **Interfaces**: PascalCase with 'I' prefix optional (e.g., `Transport` or `ITransport`)
- **Functions**: camelCase (e.g., `registerTool`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **Files**: kebab-case (e.g., `http-transport.ts`)

### Error Handling

- Always handle errors appropriately
- Provide meaningful error messages
- Use custom error classes when appropriate
- Log errors with context

```typescript
try {
  await someOperation();
} catch (error) {
  logger.error('Operation failed', { 
    error, 
    context: { userId, operation: 'someOperation' }
  });
  throw new OperationError('Failed to complete operation', { cause: error });
}
```

## Testing Guidelines

### Test Structure

- Place tests in `tests/` directory within each package
- Name test files with `.test.ts` suffix
- Group related tests using `describe` blocks

### Test Requirements

- Write unit tests for all new code
- Aim for >80% code coverage
- Test both success and error cases
- Mock external dependencies

Example:
```typescript
describe('MyClass', () => {
  let instance: MyClass;

  beforeEach(() => {
    instance = new MyClass({ /* config */ });
  });

  describe('process', () => {
    it('should process valid data', async () => {
      const result = await instance.process('valid-data');
      expect(result).toEqual({ /* expected */ });
    });

    it('should throw on invalid data', async () => {
      await expect(instance.process('')).rejects.toThrow('Invalid data');
    });
  });
});
```

### Running Tests

```bash
# All tests
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Specific package
npm test -w @tylercoles/mcp-server
```

## Documentation

### Code Documentation

- Add JSDoc comments for all public APIs
- Include examples in comments
- Document parameters and return types

```typescript
/**
 * Register a tool with the MCP server
 * 
 * @param name - Unique tool identifier
 * @param config - Tool configuration
 * @param handler - Tool implementation
 * 
 * @example
 * ```typescript
 * server.registerTool('echo', {
 *   description: 'Echo input',
 *   inputSchema: { message: z.string() }
 * }, async ({ message }) => ({
 *   content: [{ type: 'text', text: message }]
 * }));
 * ```
 */
registerTool(name: string, config: ToolConfig, handler: ToolHandler): void
```

### README Updates

- Update package README when adding features
- Include usage examples
- Document breaking changes

### API Documentation

- Keep API documentation up to date
- Document all configuration options
- Provide migration guides for breaking changes

## Workspace Management

This project uses npm workspaces. Key commands:

```bash
# Add dependency to specific package
npm install express -w @tylercoles/mcp-transport-http

# Add dev dependency
npm install -D @types/express -w @tylercoles/mcp-transport-http

# Run script in specific package
npm run build -w @tylercoles/mcp-server

# Run script in all packages
npm run build --workspaces
```

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Code style changes (formatting, etc)
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `perf:` Performance improvement
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: add WebSocket transport support
fix: handle connection timeout in HTTP transport
docs: update README with new examples
test: add unit tests for auth providers
```

## Release Process

### Version Bumping

The project uses independent versioning for packages:

```bash
# Interactive publishing tool
npm run publish:packages

# Manual version bump
npm version patch -w @tylercoles/mcp-server
npm version minor -w @tylercoles/mcp-auth
```

### Publishing Checklist

1. [ ] All tests pass
2. [ ] Documentation updated
3. [ ] CHANGELOG.md updated
4. [ ] Security audit clean
5. [ ] Version bumped appropriately
6. [ ] PR approved and merged

## Getting Help

- **Discord**: Join our community (link coming soon)
- **Issues**: Check existing issues or create new ones
- **Discussions**: Use GitHub Discussions for questions

## Recognition

Contributors will be recognized in:
- CHANGELOG.md for significant contributions
- GitHub contributors page
- Special mentions for major features

Thank you for contributing to MCP Framework! 🎉
