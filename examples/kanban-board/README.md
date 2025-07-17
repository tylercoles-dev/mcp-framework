# Kanban Board MCP Server

A comprehensive example of a Model Context Protocol (MCP) server that manages kanban boards with a SQL database backend and React frontend. This example demonstrates how to build a full-featured MCP server with tools, resources, prompts, and a web UI.

## Features

### 🗂️ **Core Kanban Functionality**
- **Boards**: Create, update, delete, and manage multiple kanban boards
- **Columns**: Organize work into customizable swim lanes (To Do, In Progress, Done, etc.)
- **Cards**: Create detailed task cards with titles, descriptions, priorities, and due dates
- **Tags**: Categorize cards with colored tags
- **Comments**: Add comments to cards for collaboration
- **Drag & Drop**: Move cards between columns (frontend only)

### 🔧 **MCP Server Features**
- **20+ Tools**: Complete CRUD operations for all kanban entities
- **Resources**: Real-time board data, statistics, and analytics
- **Prompts**: Pre-built workflows for project setup, daily standups, and sprint planning
- **HTTP Transport**: RESTful API with session management
- **Database Agnostic**: Support for SQLite, PostgreSQL, and MySQL

### 🎨 **Web Interface**
- **Responsive Design**: Modern React UI that works on desktop and mobile
- **Real-time Updates**: Live board updates via MCP tools
- **Intuitive UX**: Drag-and-drop cards, inline editing, and visual feedback
- **Multiple Boards**: Switch between different project boards

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   MCP Server    │    │   SQL Database  │
│                 │    │                 │    │                 │
│ • Board UI      │◄──►│ • 20+ Tools     │◄──►│ • Boards        │
│ • Card Mgmt     │    │ • Resources     │    │ • Columns       │
│ • Drag & Drop   │    │ • Prompts       │    │ • Cards         │
│ • Real-time     │    │ • HTTP API      │    │ • Tags          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### 🐳 **Docker Setup (Recommended)**

The easiest way to get started is with Docker. Choose your preferred database:

#### **Option A: Development with SQLite (Fastest)**
```bash
# Start development environment
make dev
# OR
docker-compose up -d

# Access the application
# Frontend: http://localhost:5173
# MCP API: http://localhost:3001/mcp
```

#### **Option B: Production with PostgreSQL**
```bash
# Start production environment
make prod
# OR
docker-compose -f docker-compose.prod.yml up -d

# Access the application
# Frontend: http://localhost
# MCP API: http://localhost/mcp
# Database: localhost:5432
```

#### **Option C: MySQL Environment**
```bash
# Start MySQL environment
make mysql
# OR
docker-compose -f docker-compose.mysql.yml up -d

# Access the application
# Frontend: http://localhost:3001
# phpMyAdmin: http://localhost:8080
# Database: localhost:3306
```

### 📋 **Manual Setup**

If you prefer to run without Docker:

#### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** or **yarn**
- **Database** (SQLite included, PostgreSQL/MySQL optional)

#### 1. Install Dependencies

```bash
# Install server dependencies
npm install

# Install frontend dependencies
npm run frontend:install
```

#### 2. Configure Database

Copy the example environment file and configure your database:

```bash
cp .env.example .env
```

**For SQLite (default):**
```env
DB_TYPE=sqlite
DB_FILE=./kanban.db
```

**For PostgreSQL:**
```env
DB_TYPE=postgres
DATABASE_URL=postgresql://username:password@localhost:5432/kanban_db
```

**For MySQL:**
```env
DB_TYPE=mysql
DATABASE_URL=mysql://username:password@localhost:3306/kanban_db
```

#### 3. Start Development

**Option A: Start both server and frontend together**
```bash
npm run dev:all
```

**Option B: Start separately**
```bash
# Terminal 1: Start MCP server
npm run dev

# Terminal 2: Start React frontend
npm run frontend:dev
```

#### 4. Access the Application

- **Frontend**: http://localhost:5173
- **MCP API**: http://localhost:3001/mcp
- **Health Check**: http://localhost:3001/health

## MCP Tools Reference

### Board Management
- `get_boards` - List all kanban boards
- `get_board` - Get detailed board information with columns and cards
- `create_board` - Create a new board
- `update_board` - Update board details
- `delete_board` - Delete a board and all its data

### Column Management  
- `create_column` - Add a new column to a board
- `update_column` - Update column properties
- `delete_column` - Remove a column and all its cards

### Card Management
- `create_card` - Create a new card in a column
- `update_card` - Update card details (title, description, priority, etc.)
- `move_card` - Move a card between columns or positions
- `delete_card` - Remove a card
- `search_cards` - Search cards by title, description, or filters

### Tags & Comments
- `get_tags` - List all available tags
- `create_tag` - Create a new tag
- `add_card_tag` - Add a tag to a card
- `remove_card_tag` - Remove a tag from a card
- `add_comment` - Add a comment to a card
- `get_comments` - Get all comments for a card
- `delete_comment` - Remove a comment

### Analytics
- `get_stats` - Get system-wide statistics and analytics

## MCP Resources

Access board data directly via resources:

- `kanban://boards` - List of all boards
- `kanban://board/{id}` - Detailed board data with columns and cards
- `kanban://stats` - Real-time analytics and statistics

## MCP Prompts

Pre-built workflows for common scenarios:

### `create_project_board`
Sets up a new project board with standard columns.

**Arguments:**
- `project_name` (required) - Name of the project
- `description` (optional) - Project description

### `daily_standup`
Generates a daily standup report for a board.

**Arguments:**
- `board_id` (required) - ID of the board to report on

### `sprint_planning`
Provides sprint planning assistance based on board state.

**Arguments:**
- `board_id` (required) - ID of the board for sprint planning
- `sprint_capacity` (optional) - Team capacity for the sprint

## Example Usage

### Creating a New Board with Tools

```bash
# Using curl to call MCP tools
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_board",
      "arguments": {
        "name": "My Project",
        "description": "A sample project board",
        "color": "#6366f1"
      }
    }
  }'
```

### Adding Cards to a Board

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "create_card",
      "arguments": {
        "board_id": 1,
        "column_id": 1,
        "title": "Implement user authentication",
        "description": "Add login and signup functionality",
        "priority": "high",
        "assigned_to": "John Doe",
        "due_date": "2025-08-01"
      }
    }
  }'
```

### Getting Board Statistics

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_stats",
      "arguments": {}
    }
  }'
```

## Database Schema

The kanban board uses a normalized SQL schema:

```sql
-- Boards: Project containers
boards (id, name, description, created_at, updated_at, color)

-- Columns: Workflow stages  
columns (id, board_id, name, position, color, created_at)

-- Cards: Individual tasks
cards (id, board_id, column_id, title, description, position, 
       priority, assigned_to, due_date, created_at, updated_at)

-- Tags: Categorization labels
tags (id, name, color, created_at)

-- Card-Tag relationships
card_tags (card_id, tag_id)

-- Comments: Collaboration notes
comments (id, card_id, content, author, created_at)
```

## 🐳 Docker Deployment Guide

### **Available Configurations**

The project includes multiple Docker Compose configurations for different environments:

| File | Purpose | Database | Use Case |
|------|---------|----------|----------|
| `docker-compose.yml` | Development | SQLite | Local development with hot reload |
| `docker-compose.prod.yml` | Production | PostgreSQL | Production with Nginx, Redis |
| `docker-compose.mysql.yml` | MySQL | MySQL | Alternative database option |

### **Development Environment**

Perfect for local development with hot reload and debugging:

```bash
# Quick start
make dev

# Manual start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

**Features:**
- ✅ SQLite database (no external dependencies)
- ✅ Hot reload for both frontend and backend
- ✅ Node.js debugging enabled on port 9229
- ✅ Volume mounts for live code changes

### **Production Environment**

Full production setup with PostgreSQL, Redis, and Nginx:

```bash
# Quick start
make prod

# Manual start
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop
docker-compose -f docker-compose.prod.yml down
```

**Features:**
- ✅ PostgreSQL database with optimized configuration
- ✅ Redis for caching and session storage
- ✅ Nginx reverse proxy with SSL support
- ✅ Multi-stage Docker build for optimal image size
- ✅ Health checks and automatic restarts
- ✅ Production-ready logging and monitoring

### **MySQL Environment**

Alternative setup using MySQL with phpMyAdmin:

```bash
# Quick start
make mysql

# Manual start
docker-compose -f docker-compose.mysql.yml up -d

# Access phpMyAdmin: http://localhost:8080
```

**Features:**
- ✅ MySQL 8.0 with UTF8MB4 support
- ✅ phpMyAdmin for database management
- ✅ Optimized MySQL configuration
- ✅ Persistent data volumes

### **Docker Commands Reference**

Use the included Makefile for convenient Docker operations:

```bash
# Environment management
make dev          # Start development environment
make prod         # Start production environment
make mysql        # Start MySQL environment

# Logs and monitoring
make logs         # View all logs
make dev-logs     # Follow development logs
make prod-logs    # Follow production logs
make health       # Check service health
make stats        # Show container resource usage

# Database operations
make db-shell-postgres    # Connect to PostgreSQL
make db-shell-mysql      # Connect to MySQL
make db-backup-postgres  # Backup PostgreSQL
make db-backup-mysql     # Backup MySQL

# Development tools
make shell        # Shell access to app container
make test         # Run tests in container
make lint         # Run linting
make typecheck    # TypeScript checking

# Cleanup
make clean        # Stop and remove volumes
make clean-all    # Remove everything including images
```

### **Environment Variables**

Configure your deployment with environment variables:

**Development (.env):**
```env
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
DB_TYPE=sqlite
DB_FILE=/app/data/kanban-dev.db
```

**Production (.env.prod):**
```env
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
DB_TYPE=postgres
DATABASE_URL=postgresql://kanban_user:kanban_pass@postgres:5432/kanban_db
REDIS_URL=redis://redis:6379
```

### **Persistent Data**

All configurations use Docker volumes for persistent data:

- **Development**: `kanban_data` (SQLite database)
- **Production**: `postgres_data`, `redis_data`, `nginx_logs`
- **MySQL**: `mysql_data`

### **Health Monitoring**

All services include health checks:

```bash
# Check health status
docker-compose ps

# View health check logs
docker inspect --format='{{json .State.Health}}' kanban-board-prod
```

### **Scaling and Performance**

**Horizontal Scaling:**
```bash
# Scale the application
docker-compose -f docker-compose.prod.yml up -d --scale kanban-board=3
```

**Resource Limits:**
Add to your compose file:
```yaml
services:
  kanban-board:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### **SSL/HTTPS Setup**

For production with SSL:

1. **Generate certificates:**
```bash
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem
```

2. **Uncomment HTTPS block** in `docker/nginx/default.conf`

3. **Start with SSL:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### **Backup and Restore**

**Database Backups:**
```bash
# PostgreSQL
make db-backup-postgres

# MySQL
make db-backup-mysql

# Restore PostgreSQL
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U kanban_user -d kanban_db < backup_20251217_120000.sql
```

**Volume Backups:**
```bash
# Backup volumes
docker run --rm -v kanban_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup.tar.gz -C /data .

# Restore volumes
docker run --rm -v kanban_postgres_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_backup.tar.gz -C /data
```

### **Troubleshooting Docker Issues**

**Common Issues:**

1. **Port conflicts:**
```bash
# Check what's using the port
netstat -tulpn | grep :3001
# Change port in docker-compose.yml
```

2. **Permission issues:**
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
```

3. **Database connection errors:**
```bash
# Check database logs
docker-compose logs postgres
# Verify connection
docker-compose exec postgres pg_isready -U kanban_user
```

4. **Out of disk space:**
```bash
# Clean up Docker
docker system prune -a --volumes
```

**Debug Mode:**
```bash
# Run with debug output
DEBUG=* docker-compose up
```

## Manual Production Deployment

If you prefer manual deployment without Docker:

### 1. Build the Application

```bash
npm run build:all
```

### 2. Environment Configuration

Create a production `.env` file:

```env
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Use PostgreSQL or MySQL for production
DB_TYPE=postgres
DATABASE_URL=postgresql://user:pass@db.example.com:5432/kanban
```

### 3. Database Setup

For production databases, run migrations:

```bash
npm run db:migrate
```

### 4. Start Production Server

```bash
npm start
```

### 5. Serve Frontend

The built frontend is in `dist/frontend/` and can be served by:
- The MCP server itself (static files)
- A reverse proxy like Nginx
- A CDN for better performance

## Development

### Project Structure

```
kanban-board/
├── src/                    # MCP Server source
│   ├── database/          # Database models and schema
│   ├── tools/             # MCP tools implementation
│   ├── types/             # TypeScript type definitions
│   └── index.ts           # Main server entry point
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # MCP client
│   │   └── types/         # Frontend types
│   └── public/            # Static assets
├── dist/                  # Built files
└── docs/                  # Documentation
```

### Adding New Features

**1. Add a new tool:**

```typescript
// src/tools/kanban-tools.ts
private createMyNewTool(): Tool {
  return {
    name: 'my_new_tool',
    title: 'My New Tool',
    description: 'Description of what it does',
    inputSchema: {
      type: 'object',
      properties: {
        // Define parameters
      },
      required: ['param1']
    },
    handler: async (args): Promise<ToolResult> => {
      // Implementation
    }
  };
}
```

**2. Add to tools list:**

```typescript
getTools(): Tool[] {
  return [
    // ... existing tools
    this.createMyNewTool(),
  ];
}
```

**3. Update frontend if needed:**

```typescript
// frontend/src/services/mcp-client.ts
const result = await mcpClient.callTool('my_new_tool', { param1: 'value' });
```

### Running Tests

```bash
# Run server tests
npm test

# Run frontend tests  
npm run frontend:test

# Run linting
npm run lint
npm run frontend:lint

# Type checking
npm run typecheck
npm run frontend:typecheck
```

## Troubleshooting

### Common Issues

**1. Database connection errors**
- Check your database credentials in `.env`
- Ensure the database server is running
- Verify network connectivity

**2. Port conflicts**
- Change `PORT` in `.env` if 3001 is in use
- Update Vite proxy config in `frontend/vite.config.ts`

**3. Frontend not connecting to MCP server**
- Verify both servers are running
- Check CORS settings in server configuration
- Ensure proxy configuration in Vite

**4. Build errors**
- Run `npm run clean` and rebuild
- Check TypeScript errors with `npm run typecheck`
- Verify all dependencies are installed

### Performance Optimization

**1. Database optimization:**
- Add indexes for frequently queried columns
- Use connection pooling for PostgreSQL/MySQL
- Consider read replicas for high traffic

**2. Frontend optimization:**
- Implement virtual scrolling for large boards
- Add pagination for cards and comments
- Use React.memo for card components

**3. Server optimization:**
- Enable response compression
- Add Redis caching for board data
- Implement rate limiting

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Commit changes: `git commit -am 'Add my feature'`
6. Push to branch: `git push origin feature/my-feature`
7. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related

- [MCP Framework Documentation](../../README.md)
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)

---

This example demonstrates a production-ready MCP server with comprehensive functionality, proper error handling, and a modern web interface. It serves as a template for building your own MCP servers with database backends and user interfaces.