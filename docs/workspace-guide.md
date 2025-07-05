# Workspace Configuration Guide

This project uses **npm workspaces** for monorepo management (migrated from Lerna).

## Prerequisites

- npm version 7 or higher (check with `npm --version`)
- Node.js 18 or higher

## Quick Start

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Verify workspace setup
npm run verify
```

## Available Scripts

### Building
- `npm run build` - Build all packages in parallel
- `npm run build:order` - Build packages in dependency order
- `npm run build -w @tylercoles/mcp-server` - Build specific package

### Testing
- `npm test` - Run all tests
- `npm run test:all` - Run tests with summary report
- `npm run test:coverage` - Run tests with coverage
- `npm run coverage:report` - Generate coverage summary
- `npm test -w @tylercoles/mcp-auth` - Test specific package

### Development
- `npm run dev` - Run all packages in watch mode
- `npm run dev -w @tylercoles/mcp-server` - Watch specific package

### Maintenance
- `npm run clean` - Clean all build artifacts and node_modules
- `npm run lint` - Lint all packages
- `npm run typecheck` - TypeScript type checking
- `npm run verify` - Verify workspace configuration

### Publishing
- `npm run publish:packages` - Interactive publishing tool

### Workspace Commands
- `npm run ws` - Shortcut for npm workspaces commands
- `npm run ws:info` - List all workspace packages
- `npm ls` - Show full dependency tree

## Working with Specific Packages

npm workspaces allows you to run commands on specific packages:

```bash
# Install dependency in specific package
npm install express -w @tylercoles/mcp-transport-http

# Run script in specific package
npm run test -w @tylercoles/mcp-server

# Install dev dependency
npm install -D @types/jest -w @tylercoles/mcp-auth
```

## Package Structure

```
@tylercoles/
├── packages/
│   ├── mcp-server/          # Core server framework
│   ├── mcp-auth/            # Auth abstractions
│   ├── mcp-transport-stdio/ # stdio transport
│   ├── mcp-transport-http/  # HTTP transport
│   └── mcp-auth-authentik/  # Authentik OAuth provider
├── examples/
│   ├── echo-server/
│   ├── multi-transport-server/
│   └── memory-server/
└── tools/                   # Build and maintenance scripts
```

## Dependency Management

Packages use the `0.1.0` protocol for internal dependencies:

```json
{
  "dependencies": {
    "@tylercoles/mcp-server": "0.1.0"
  }
}
```

This ensures:
- Local packages are always used during development
- Versions are resolved correctly during publishing
- No need to manually link packages

## Troubleshooting

### Installation Issues
```bash
# Clean everything and reinstall
npm run clean
npm install
```

### Build Order Issues
```bash
# Use dependency-aware build
npm run build:order
```

### Verification
```bash
# Check workspace configuration
npm run verify
```

## Migration from Lerna

This project was migrated from Lerna to npm workspaces. Key changes:

1. Removed `lerna.json` and Lerna dependency
2. Updated scripts to use `npm run <script> --workspaces`
3. All packages now use `0.1.0` protocol
4. Publishing handled by custom script

## Benefits of npm Workspaces

- **No extra dependencies** - Built into npm 7+
- **Better performance** - Native hoisting and linking
- **Simpler configuration** - Just the workspaces field
- **Standard tooling** - Works with all npm commands
- **Automatic linking** - No need for `npm link`
