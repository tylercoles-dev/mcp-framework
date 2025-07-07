# Jira MCP Server Example

A Model Context Protocol (MCP) server that provides integration with Jira using API tokens. This example demonstrates how to build a production-ready MCP server with comprehensive Jira functionality.

## Features

- **Search Issues**: Search for Jira issues using JQL queries with formatted results
- **Assigned Issues**: Get issues assigned to specific users with filtering by status and project
- **Issue Management**: Get, create, and update issues with full field support
- **Comments**: Add comments to issues using Jira's document format
- **Custom Fields**: Full support for reading and setting custom field values with automatic type handling
- **Project Information**: List projects and available issue types
- **Multi-Transport**: Supports both stdio and HTTP transports
- **Authentication**: API token-based authentication for secure access
- **Error Handling**: Comprehensive error handling with user-friendly messages

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your Jira details:
   - `JIRA_BASE_URL`: Your Jira instance URL (e.g., `https://your-domain.atlassian.net`)
   - `JIRA_EMAIL`: Your Jira account email
   - `JIRA_API_TOKEN`: Your Jira API token

3. **Get your Jira API token**:
   - Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Create a new API token
   - Copy the token to your `.env` file

4. **Build the project**:
   ```bash
   npm run build
   ```

## Usage

### stdio Transport (Default)
Perfect for local development and direct MCP client integration:
```bash
npm start
# or explicitly
npm run start:stdio
```

### HTTP Transport
Great for web-based integrations and remote access:
```bash
npm run start:http
```

The HTTP server will start on port 3000 (configurable via `PORT` environment variable) with API token authentication enabled.

## Available Tools

### 🔍 search_issues
Search for issues using JQL (Jira Query Language).

**Parameters:**
- `jql` (string, required): JQL query
- `maxResults` (number, optional): Maximum results to return (default: 50)

**Example:**
```jql
project = MYPROJ AND status = "To Do"
```

### 👤 get_assigned_issues
Get issues assigned to a specific user or the current user with optional filtering.

**Parameters:**
- `assignee` (string, optional): Username, email, or "currentUser()" for current user. Leave empty for current user.
- `status` (string, optional): Filter by status (e.g., "To Do", "In Progress", "Done")
- `project` (string, optional): Filter by project key
- `maxResults` (number, optional): Maximum results to return (default: 50)

**Examples:**
```typescript
// Get all issues assigned to current user
{ }

// Get issues assigned to specific user
{ assignee: "john.doe@company.com" }

// Get current user's "In Progress" issues in specific project
{ status: "In Progress", project: "MYPROJ" }
```

### 📋 get_issue
Get detailed information about a specific issue.

**Parameters:**
- `issueKey` (string, required): Issue key (e.g., "PROJ-123")

### ➕ create_issue
Create a new issue in a Jira project.

**Parameters:**
- `projectKey` (string, required): Project key
- `summary` (string, required): Issue summary
- `description` (string, optional): Issue description
- `issueType` (string, required): Issue type (e.g., "Story", "Bug", "Task")
- `priority` (string, optional): Priority level (default: "Medium")
- `customFields` (object, optional): Custom field values as key-value pairs (fieldId or fieldName: value)

### ✏️ update_issue
Update an existing issue including status transitions.

**Parameters:**
- `issueKey` (string, required): Issue key to update
- `summary` (string, optional): New summary
- `description` (string, optional): New description
- `status` (string, optional): New status (triggers transition)
- `customFields` (object, optional): Custom field values to update as key-value pairs (fieldId or fieldName: value)

### 💬 add_comment
Add a comment to an issue.

**Parameters:**
- `issueKey` (string, required): Issue key
- `comment` (string, required): Comment text

### 📁 get_projects
List all available projects with details.

### 🏷️ get_issue_types
Get available issue types for a specific project.

**Parameters:**
- `projectKey` (string, required): Project key

### 🔧 get_custom_fields
Get custom fields available in Jira with their IDs and types.

**Parameters:**
- `projectKey` (string, optional): Filter by project key to see project-specific fields
- `search` (string, optional): Search term to filter field names

**Examples:**
```typescript
// Get all custom fields
{ }

// Get custom fields for specific project
{ projectKey: "MYPROJ" }

// Search for fields containing "priority"
{ search: "priority" }
```

### 📊 get_issue_custom_fields
Get custom field values for a specific issue.

**Parameters:**
- `issueKey` (string, required): Issue key (e.g., "PROJ-123")
- `fieldNames` (array, optional): Specific custom field names to retrieve

**Examples:**
```typescript
// Get all custom fields for an issue
{ issueKey: "PROJ-123" }

// Get specific custom fields
{ issueKey: "PROJ-123", fieldNames: ["Story Points", "Epic Link"] }
```

### ⚙️ set_issue_custom_field
Set a custom field value for an issue.

**Parameters:**
- `issueKey` (string, required): Issue key (e.g., "PROJ-123")
- `fieldId` (string, required): Custom field ID (e.g., "customfield_10001") or field name
- `value` (any, required): Value to set (format depends on field type)
- `valueType` (enum, optional): Type hint for value formatting ("text", "number", "select", "multiselect", "user", "date", "datetime")

**Examples:**
```typescript
// Set text field
{ issueKey: "PROJ-123", fieldId: "Story Points", value: "5", valueType: "number" }

// Set select field
{ issueKey: "PROJ-123", fieldId: "customfield_10001", value: "High", valueType: "select" }

// Set user field
{ issueKey: "PROJ-123", fieldId: "Reviewer", value: "john.doe", valueType: "user" }

// Clear field (set to null)
{ issueKey: "PROJ-123", fieldId: "Epic Link", value: null }
```

## Environment Configuration

- `JIRA_BASE_URL`: Your Jira instance URL (required)
- `JIRA_EMAIL`: Your Jira account email (required)
- `JIRA_API_TOKEN`: Your Jira API token (required)
- `TRANSPORT`: Transport type - "stdio" or "http" (default: "stdio")
- `PORT`: HTTP server port (default: 3000)
- `USE_AUTH`: Enable authentication for HTTP transport (default: true)
- `DEBUG`: Enable debug logging (default: false)

## Authentication

This server uses Jira API tokens for authentication:
- **stdio transport**: Uses environment variables directly
- **HTTP transport**: Validates bearer tokens against the configured API token

## Architecture

Built on the [@tylercoles/mcp-server](../../../packages/mcp-server) framework:
- Modular transport system supporting stdio and HTTP
- Type-safe tool definitions with Zod schema validation
- Comprehensive error handling and logging
- Production-ready configuration management

## Development

```bash
# Development with watch mode
npm run dev

# Build
npm run build

# Run with debug logging
DEBUG=true npm start
```

## License

MIT
