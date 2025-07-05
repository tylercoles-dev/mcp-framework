# Changelog

## 2025-07-05

### Added SSE Transport Package

Created a new transport package for Server-Sent Events (SSE) to provide backwards compatibility with older MCP clients.

#### New Package

1. **@tylercoles/mcp-transport-sse**
   - Implements SSE transport using SDK's SSEServerTransport
   - Provides backwards compatibility with HTTP+SSE transport from protocol version 2024-11-05
   - Includes session management and DNS rebinding protection
   - Exposes three endpoints: `/sse`, `/messages`, and `/health`

#### Example Server

2. **examples/sse-server**
   - Demonstrates SSE transport with optional stdio support
   - Configurable via environment variables or command line arguments
   - Includes example tools, resources, and prompts
   - Supports graceful shutdown

#### Core Framework Updates

3. **Fixed type issues in @tylercoles/mcp-server**
   - Changed from `registerTool()` to `tool()` method on SDK server
   - Changed from `registerResource()` to `resource()` method on SDK server
   - Changed from `registerPrompt()` to `prompt()` method on SDK server
   - Aligned with actual SDK method signatures

## 2025-07-06

### Migration from Lerna to npm Workspaces

Successfully migrated the monorepo from Lerna to native npm workspaces:

#### Changes Made

1. **Removed Lerna Dependency**
   - Deleted `lerna.json`
   - Removed lerna from devDependencies
   - Updated all scripts to use npm workspaces commands

2. **Updated Scripts**
   - `npm run build` - Uses `--workspaces` flag
   - `npm run test` - Runs tests in all workspaces
   - `npm run clean` - Custom script for workspace cleanup
   - `npm run verify` - Verify workspace configuration
   - `npm run publish:packages` - Interactive publishing tool

3. **New Tools**
   - `tools/build-workspaces.js` - Build in dependency order
   - `tools/clean-workspace.js` - Clean all packages and node_modules
   - `tools/verify-workspaces.js` - Verify workspace setup
   - `tools/publish-packages.js` - Interactive publishing workflow

4. **Documentation**
   - Created comprehensive workspace guide
   - Updated README with workspace commands
   - Updated CI workflow to verify workspaces

#### Benefits

- **No extra dependencies** - npm workspaces is built-in (npm 7+)
- **Better performance** - Native package linking
- **Simpler configuration** - Just the workspaces field in package.json
- **Standard tooling** - All npm commands work naturally
- **Easier debugging** - Direct npm commands for each package

#### Workspace Commands

```bash
# Package-specific commands
npm run build -w @tylercoles/mcp-server
npm install express -w @tylercoles/mcp-transport-http

# Workspace utilities
npm run ws:info          # List all packages
npm run verify           # Verify configuration
npm run build:order      # Build in dependency order
```

### Comprehensive Unit Testing Implementation

Added unit tests for all framework packages with >80% coverage targets:

#### Test Coverage by Package

1. **@tylercoles/mcp-server**
   - Comprehensive tests for server lifecycle
   - Tool, resource, and prompt registration tests
   - Context management and introspection tests
   - Multi-transport support verification
   - Error handling scenarios

2. **@tylercoles/mcp-auth**
   - Tests for all built-in auth providers (NoAuth, DevAuth, BearerTokenAuth, SessionAuth)
   - OAuth provider base class tests
   - Middleware generation tests
   - Discovery route creation tests
   - Error handling and edge cases

3. **@tylercoles/mcp-transport-stdio**
   - Transport lifecycle tests
   - Message handling via stdio
   - Logging configuration tests
   - Error handling and cleanup tests
   - SDK integration tests

4. **@tylercoles/mcp-transport-http**
   - HTTP server lifecycle tests
   - Session management tests
   - Router registration API tests
   - Authentication middleware integration
   - CORS and security header tests
   - SSE endpoint handling
   - Error handling and edge cases

5. **@tylercoles/mcp-auth-authentik**
   - OAuth flow implementation tests
   - Token verification and refresh tests
   - Group-based access control tests
   - Discovery metadata tests
   - Session handling tests
   - Error scenarios

#### Testing Infrastructure

- Added jest configurations for all packages
- Created test runner script (`tools/test-all.js`)
- Created coverage reporter (`tools/coverage-report.js`)
- Added GitHub Actions CI workflow
- Updated package.json with test scripts:
  - `npm test` - Run tests in all packages
  - `npm run test:all` - Run all tests with summary
  - `npm run test:coverage` - Run tests with coverage
  - `npm run coverage:report` - Generate coverage summary

#### Key Testing Patterns

- Comprehensive mocking of external dependencies
- Request/response helpers for Express testing
- Supertest for HTTP endpoint testing
- Clear test organization by feature
- Error scenario coverage
- Edge case handling

This testing suite ensures the framework is reliable, maintainable, and ready for production use.

## 2024-01-10

### Memory Server Introspection Integration

Updated the memory-server example to fully utilize the framework's introspection capabilities:

#### API Updates
- **Dynamic Tool Discovery**: `/api/tools` endpoint now uses `mcpServer.getTools()` instead of hardcoded list
- **Tool Details Endpoint**: Added `/api/tools/:name` for detailed tool information including schemas
- **Capabilities Endpoint**: Added `/api/capabilities` for complete server introspection
- **Removed Hardcoding**: Eliminated all hardcoded tool lists in favor of runtime discovery

#### New Features
- **Meta Tool**: Added `list_available_tools` tool that demonstrates in-MCP introspection
- **Complete Tool Info**: API responses now include title, description, and input schemas
- **Server Overview**: Capabilities endpoint provides counts and names for all registered items

#### Documentation
- Added comprehensive API endpoints documentation
- Documented introspection features with curl examples
- Updated available tools list to include the meta tool

This demonstrates how servers built with the framework can:
- Provide runtime discovery of capabilities
- Build dynamic UIs based on available tools
- Implement meta-tools that query the server itself
- Expose REST APIs alongside MCP protocol

## 2024-01-10

### Multi-Transport Support Completed

Enhanced the MCP framework with full multi-transport capabilities:

#### Core Features
- **Multi-Transport Support**: Servers can now use multiple transports simultaneously
- **Introspection API**: Added methods to query server capabilities at runtime
  - `getTools()`, `getTool(name)` - Query registered tools
  - `getResources()`, `getResource(name)` - Query registered resources  
  - `getPrompts()`, `getPrompt(name)` - Query registered prompts
  - `getCapabilities()` - Get summary of all capabilities
- **Transport Context**: Tools can access which transport a request came from

#### New Example
- **multi-transport-server**: Demonstrates running HTTP and stdio transports together
  - Shows transport-aware tool responses
  - Includes capability listing tool
  - Environment-based transport configuration

#### Benefits
- Single server instance can serve multiple client types
- Web applications can use HTTP while CLI tools use stdio
- Shared tool implementations across all transports
- Runtime introspection for dynamic UI generation
- Better debugging with transport context

## 2024-01-09

### Router Registration API

Added router registration functionality to HTTP transport:
- `createRouter(requireAuth)` - Create routers with optional auth
- `registerRouter(path, router, requireAuth)` - Register routers after server start
- `getAuthMiddleware()` - Get auth middleware for manual use
- `getAuthenticatedUser(req)` - Helper to get user from request

This makes it much easier to add custom routes with proper authentication:
```typescript
// Public routes
const publicRouter = transport.createRouter(false);
transport.registerRouter('/public', publicRouter);

// Protected routes
const apiRouter = transport.createRouter(true);
transport.registerRouter('/api', apiRouter);
```

## 2024-01-08

### Framework Extraction - Phase 1 Complete

Successfully extracted the core MCP server infrastructure from the `mcp-memories` project into reusable framework packages.

#### Packages Created

1. **@tylercoles/mcp-server** (Core Framework)
   - Plugin architecture for transports and tools
   - Context injection for tool handlers
   - Type-safe tool, resource, and prompt registration
   - Wrapper around the official MCP SDK

2. **@tylercoles/mcp-auth** (Auth Abstractions)
   - Base `AuthProvider` class
   - `OAuthProvider` for OAuth flows
   - Built-in providers: `NoAuth`, `DevAuth`, `BearerTokenAuth`, `SessionAuth`
   - Middleware utilities

3. **@tylercoles/mcp-transport-stdio** (stdio Transport)
   - Simple stdio transport for CLI usage
   - Minimal configuration required
   - Debug logging to stderr

4. **@tylercoles/mcp-transport-http** (HTTP Transport)
   - Streamable HTTP transport with SSE support
   - Session management with UUID generation
   - CORS and security headers via Helmet
   - Integration with auth providers

5. **@tylercoles/mcp-auth-authentik** (Authentik Provider)
   - Full OAuth flow implementation
   - Token verification and refresh
   - Group-based access control
   - Discovery document caching

#### Examples Created

- **echo-server** - Demonstrates basic framework usage with both stdio and HTTP transports

#### Architecture Decisions

- Used Lerna for monorepo management
- Workspace protocol for inter-package dependencies
- TypeScript for full type safety
- Modular design allowing easy extension

#### Next Steps

1. Refactor `memory-server` example to use the new framework packages
2. Add comprehensive tests for all packages
3. Create additional auth providers (Auth0, etc.)
4. Add more examples (file server, API gateway)
5. Publish packages to NPM

### OAuth Framework Enhancement

Enhanced the framework to handle all OAuth-related endpoints automatically:
- Added OAuth discovery metadata support to auth providers
- HTTP transport now automatically sets up discovery endpoints
- Authentik provider implements full OAuth flow with passport
- All MCP-required endpoints handled by framework:
  - `/.well-known/oauth-protected-resource`
  - `/.well-known/oauth-authorization-server`
  - `/application/o/register/` (dynamic registration)
  - `/auth/login`, `/auth/callback`, etc.

### Memory Server Migration

Successfully migrated the `memory-server` example to use the new framework packages:
- Replaced direct MCP SDK usage with `MCPServer` from `@tylercoles/mcp-server`
- Replaced custom HTTP/SSE implementation with `HttpTransport` from `@tylercoles/mcp-transport-http`
- Replaced custom Authentik integration with `AuthentikAuth` from `@tylercoles/mcp-auth-authentik`
- Moved tool registration to separate `tools/memory-tools.ts` file
- Simplified main server file from ~600 lines to ~180 lines
- Removed ALL OAuth boilerplate - handled by framework
- Maintained all existing functionality while reducing complexity

### Notes

- The framework maintains full compatibility with the MCP specification
- HTTP transport supports both the modern Streamable HTTP and can be extended for SSE compatibility
- All packages are designed to be tree-shakeable and have minimal dependencies
- The memory-server example demonstrates real-world usage with external services (NATS) and OAuth
