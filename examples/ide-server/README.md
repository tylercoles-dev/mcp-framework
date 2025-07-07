# MCP Ide Server Example

A comprehensive MCP server that provides project management and git tools. Can be extended to wrap other MCP servers like Serena for enhanced functionality.

## Features

### Project Management Tools
- **`create_project`** - Create new projects with proper structure (Node.js, React, Next.js, Python, Generic)
- **`setup_workspace`** - Configure development environment (VS Code, .gitignore, .editorconfig, Prettier)
- **`manage_dependencies`** - Smart package management with JSON validation (npm, pip, cargo)

### Git Tools with Smart Authentication
- **`git_commit`** - Stage and commit changes with flexible file selection
- **`git_push`** - Push to remotes with upstream setting and force options
- **`git_pull`** - Pull changes with rebase options
- **`git_branch`** - Create, switch, delete, and list branches
- **`git_status`** - Repository status with remote information
- **`git_clone`** - Clone repositories with automatic workspace setup
- **`generate_ssh_key`** - Generate SSH keys with GitHub integration

### Smart Features
- **Authentication Detection** - Git operations detect auth failures and guide users through SSH setup
- **Project Type Detection** - Auto-detects project types and suggests appropriate configurations
- **Workspace Integration** - Optional VS Code and development environment setup
- **Security Best Practices** - Proper file permissions, Ed25519 keys, SSH agent integration

## Installation

```bash
npm install
npm run build
```

## Usage

### As Standalone Server

```bash
npm start
```

### In MCP Client Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "wrapper-server": {
      "command": "node",
      "args": ["path/to/wrapper-server/dist/index.js"]
    }
  }
}
```

## Example Workflows

### New Project Setup
1. `create_project` - Create project structure
2. `setup_workspace` - Configure development environment
3. `generate_ssh_key` - Set up git authentication
4. `git_commit` and `git_push` - Initial commit

### Clone and Setup
1. `git_clone` - Clone repository with automatic setup
2. `manage_dependencies` - Install project dependencies
3. Start coding with configured environment

### Daily Git Workflow
1. `git_status` - Check repository status
2. `git_commit` - Commit changes
3. `git_push` - Push to remote (with automatic auth guidance)

## Authentication Handling

When git operations fail due to authentication issues, the server provides helpful guidance:

- Detects SSH and HTTPS authentication failures
- Provides step-by-step troubleshooting
- Suggests using `generate_ssh_key` for setup
- Offers alternative solutions (HTTPS vs SSH)

## Extension Possibilities

This server can be extended to wrap other MCP servers:

```typescript
// Example: Wrapping Serena for enhanced code editing
async handleToolCall(request: CallToolRequest) {
  // Handle custom tools first
  if (request.params.name === 'create_project') {
    return await this.createProject(request.params.arguments);
  }
  
  // Forward code editing tools to Serena
  return await this.forwardToSerena(request);
}
```

## Security Considerations

- SSH keys generated with secure defaults (Ed25519)
- Proper file permissions (600 for private keys, 644 for public)
- Secure .ssh directory setup
- Optional passphrase protection

## Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## License

MIT - See [LICENSE](../../LICENSE) for details.