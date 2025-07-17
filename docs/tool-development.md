# Tool Development Guide

This guide covers advanced techniques for developing tools in the MCP Framework, including best practices, patterns, and advanced features.

## Tool Architecture

### Basic Tool Structure

```typescript
import { MCPServer } from '@tylercoles/mcp-server';

const server = new MCPServer({
  name: 'advanced-server',
  version: '1.0.0'
});

server.addTool({
  name: 'example_tool',
  description: 'A well-structured example tool',
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input parameter' }
    },
    required: ['input']
  }
}, async (params, context) => {
  // Tool implementation
  return {
    text: `Processed: ${params.input}`,
    data: { result: params.input.toUpperCase() }
  };
});
```

### Advanced Tool Structure

```typescript
interface ToolContext {
  user?: {
    id: string;
    name: string;
    email: string;
    roles: string[];
  };
  request: {
    id: string;
    timestamp: Date;
    transport: string;
  };
  server: MCPServer;
}

interface ToolResult {
  text: string;
  data?: any;
  metadata?: {
    executionTime?: number;
    cached?: boolean;
    warnings?: string[];
  };
}

server.addTool({
  name: 'advanced_tool',
  description: 'Advanced tool with comprehensive features',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
        minLength: 1,
        maxLength: 1000
      },
      options: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
          format: { type: 'string', enum: ['json', 'text', 'csv'], default: 'json' }
        }
      }
    },
    required: ['query']
  }
}, async (params, context): Promise<ToolResult> => {
  const startTime = Date.now();
  
  try {
    // Input validation
    if (!params.query.trim()) {
      throw new Error('Query cannot be empty');
    }
    
    // Access control
    if (!context.user) {
      throw new Error('Authentication required');
    }
    
    // Rate limiting per user
    await checkRateLimit(context.user.id);
    
    // Business logic
    const result = await processQuery(params.query, params.options);
    
    // Log the operation
    await logOperation(context.user.id, 'advanced_tool', params.query);
    
    return {
      text: `Found ${result.length} results for "${params.query}"`,
      data: result,
      metadata: {
        executionTime: Date.now() - startTime,
        cached: false
      }
    };
    
  } catch (error) {
    // Error handling
    console.error('Tool error:', error);
    throw new Error(`Tool execution failed: ${error.message}`);
  }
});
```

## Input Validation and Schema Design

### Comprehensive Schema Examples

```typescript
// File operation tool
server.addTool({
  name: 'file_operations',
  description: 'Perform file operations',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['read', 'write', 'delete', 'list'],
        description: 'Operation to perform'
      },
      path: {
        type: 'string',
        pattern: '^[a-zA-Z0-9/._-]+$',
        description: 'File path (alphanumeric, slashes, dots, underscores, hyphens only)'
      },
      content: {
        type: 'string',
        description: 'Content to write (required for write operation)'
      },
      options: {
        type: 'object',
        properties: {
          encoding: {
            type: 'string',
            enum: ['utf8', 'utf16le', 'base64'],
            default: 'utf8'
          },
          recursive: {
            type: 'boolean',
            default: false,
            description: 'Recursive operation for directories'
          }
        }
      }
    },
    required: ['operation', 'path'],
    allOf: [
      {
        if: { properties: { operation: { const: 'write' } } },
        then: { required: ['content'] }
      }
    ]
  }
}, async (params, context) => {
  // Implementation with conditional validation
  switch (params.operation) {
    case 'write':
      if (!params.content) {
        throw new Error('Content is required for write operation');
      }
      break;
    case 'read':
      // Read validation
      break;
    // ... other operations
  }
});

// Data processing tool with complex validation
server.addTool({
  name: 'data_processor',
  description: 'Process data with various transformations',
  inputSchema: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            value: { type: 'number' },
            category: { type: 'string' }
          },
          required: ['id', 'value']
        },
        minItems: 1,
        maxItems: 1000
      },
      transformations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['filter', 'map', 'reduce', 'sort']
            },
            expression: {
              type: 'string',
              description: 'JavaScript expression for transformation'
            },
            field: {
              type: 'string',
              description: 'Field to operate on'
            }
          },
          required: ['type']
        }
      },
      output: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['json', 'csv', 'xml'],
            default: 'json'
          },
          compression: {
            type: 'boolean',
            default: false
          }
        }
      }
    },
    required: ['data', 'transformations']
  }
}, async (params, context) => {
  // Complex data processing implementation
});
```

### Runtime Validation

```typescript
import { z } from 'zod';

// Define Zod schemas for additional validation
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().min(18).max(120),
  roles: z.array(z.string()).min(1)
});

server.addTool({
  name: 'user_management',
  description: 'Manage user accounts',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'update', 'delete'] },
      user: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'number' },
          roles: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    required: ['action', 'user']
  }
}, async (params, context) => {
  try {
    // Additional runtime validation with Zod
    if (params.action === 'create' || params.action === 'update') {
      const validatedUser = UserSchema.parse(params.user);
      // Proceed with validated user data
    }
    
    // Business logic
    return { text: 'User operation completed' };
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
});
```

## Error Handling and Logging

### Comprehensive Error Handling

```typescript
class ToolError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

server.addTool({
  name: 'robust_tool',
  description: 'Tool with comprehensive error handling',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string' }
    },
    required: ['action']
  }
}, async (params, context) => {
  const logger = context.server.getLogger();
  
  try {
    logger.info('Tool execution started', {
      tool: 'robust_tool',
      user: context.user?.id,
      params: params
    });
    
    // Validation
    if (!params.action) {
      throw new ToolError('Action is required', 'MISSING_ACTION', 400);
    }
    
    // Business logic that might fail
    const result = await performAction(params.action);
    
    logger.info('Tool execution completed', {
      tool: 'robust_tool',
      user: context.user?.id,
      success: true
    });
    
    return {
      text: 'Action completed successfully',
      data: result
    };
    
  } catch (error) {
    logger.error('Tool execution failed', {
      tool: 'robust_tool',
      user: context.user?.id,
      error: error.message,
      stack: error.stack
    });
    
    if (error instanceof ToolError) {
      throw error;
    }
    
    // Map known errors
    if (error.code === 'ENOENT') {
      throw new ToolError('File not found', 'FILE_NOT_FOUND', 404);
    }
    
    if (error.code === 'EACCES') {
      throw new ToolError('Permission denied', 'PERMISSION_DENIED', 403);
    }
    
    // Generic error
    throw new ToolError(
      'Internal tool error',
      'INTERNAL_ERROR',
      500,
      { originalError: error.message }
    );
  }
});
```

### Structured Logging

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'tool-errors.log', level: 'error' }),
    new winston.transports.File({ filename: 'tool-activity.log' })
  ]
});

server.setLogger(logger);

// Tool with structured logging
server.addTool({
  name: 'logged_tool',
  description: 'Tool with comprehensive logging',
  inputSchema: { /* schema */ }
}, async (params, context) => {
  const operationId = generateOperationId();
  
  logger.info('Tool operation started', {
    operationId,
    tool: 'logged_tool',
    user: context.user?.id,
    timestamp: new Date().toISOString(),
    params: sanitizeForLogging(params)
  });
  
  try {
    const result = await performOperation(params);
    
    logger.info('Tool operation completed', {
      operationId,
      tool: 'logged_tool',
      user: context.user?.id,
      duration: Date.now() - startTime,
      success: true
    });
    
    return result;
    
  } catch (error) {
    logger.error('Tool operation failed', {
      operationId,
      tool: 'logged_tool',
      user: context.user?.id,
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime
    });
    
    throw error;
  }
});
```

## Authentication and Authorization

### Role-Based Access Control

```typescript
// Define roles and permissions
const ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
  GUEST: 'guest'
};

const PERMISSIONS = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  ADMIN: 'admin'
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.DELETE, PERMISSIONS.ADMIN],
  [ROLES.MODERATOR]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.DELETE],
  [ROLES.USER]: [PERMISSIONS.READ, PERMISSIONS.WRITE],
  [ROLES.GUEST]: [PERMISSIONS.READ]
};

// Authorization helper
function requirePermission(permission: string) {
  return (context: ToolContext) => {
    if (!context.user) {
      throw new Error('Authentication required');
    }
    
    const userPermissions = context.user.roles.reduce((perms, role) => {
      return perms.concat(ROLE_PERMISSIONS[role] || []);
    }, []);
    
    if (!userPermissions.includes(permission)) {
      throw new Error(`Permission '${permission}' required`);
    }
  };
}

// Protected tools
server.addTool({
  name: 'admin_tool',
  description: 'Admin-only tool',
  inputSchema: { /* schema */ }
}, async (params, context) => {
  requirePermission(PERMISSIONS.ADMIN)(context);
  
  // Admin logic
  return { text: 'Admin operation completed' };
});

server.addTool({
  name: 'write_tool',
  description: 'Tool requiring write permission',
  inputSchema: { /* schema */ }
}, async (params, context) => {
  requirePermission(PERMISSIONS.WRITE)(context);
  
  // Write logic
  return { text: 'Write operation completed' };
});
```

### Resource-Based Authorization

```typescript
// Resource ownership check
async function checkResourceOwnership(resourceId: string, userId: string) {
  const resource = await db.query('SELECT user_id FROM resources WHERE id = $1', [resourceId]);
  if (!resource.rows[0] || resource.rows[0].user_id !== userId) {
    throw new Error('Access denied: Resource not owned by user');
  }
}

server.addTool({
  name: 'update_resource',
  description: 'Update a user resource',
  inputSchema: {
    type: 'object',
    properties: {
      resourceId: { type: 'string' },
      updates: { type: 'object' }
    },
    required: ['resourceId', 'updates']
  }
}, async (params, context) => {
  if (!context.user) {
    throw new Error('Authentication required');
  }
  
  // Check ownership
  await checkResourceOwnership(params.resourceId, context.user.id);
  
  // Update resource
  const result = await updateResource(params.resourceId, params.updates);
  
  return {
    text: 'Resource updated successfully',
    data: result
  };
});
```

## Performance Optimization

### Caching Strategies

```typescript
import NodeCache from 'node-cache';

const cache = new NodeCache({
  stdTTL: 600, // 10 minutes default TTL
  checkperiod: 120 // Check for expired keys every 2 minutes
});

server.addTool({
  name: 'cached_tool',
  description: 'Tool with caching',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      useCache: { type: 'boolean', default: true }
    },
    required: ['query']
  }
}, async (params, context) => {
  const cacheKey = `tool_result_${params.query}`;
  
  // Check cache first
  if (params.useCache) {
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return {
        text: 'Cached result',
        data: cachedResult,
        metadata: { cached: true }
      };
    }
  }
  
  // Compute result
  const result = await expensiveOperation(params.query);
  
  // Cache result
  if (params.useCache) {
    cache.set(cacheKey, result, 300); // Cache for 5 minutes
  }
  
  return {
    text: 'Fresh result',
    data: result,
    metadata: { cached: false }
  };
});
```

### Connection Pooling

```typescript
import { Pool } from 'pg';

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

server.addTool({
  name: 'database_tool',
  description: 'Tool with database connection pooling',
  inputSchema: { /* schema */ }
}, async (params, context) => {
  const client = await dbPool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Database operations
    const result = await client.query('SELECT * FROM users WHERE id = $1', [params.userId]);
    
    await client.query('COMMIT');
    
    return {
      text: 'Database operation completed',
      data: result.rows
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
```

### Async Processing and Queues

```typescript
import Bull from 'bull';

const processQueue = new Bull('process queue', {
  redis: { host: 'localhost', port: 6379 }
});

// Process jobs
processQueue.process(async (job) => {
  const { operation, data } = job.data;
  return await performLongRunningOperation(operation, data);
});

server.addTool({
  name: 'async_tool',
  description: 'Tool with async processing',
  inputSchema: {
    type: 'object',
    properties: {
      operation: { type: 'string' },
      data: { type: 'object' },
      async: { type: 'boolean', default: false }
    },
    required: ['operation', 'data']
  }
}, async (params, context) => {
  if (params.async) {
    // Queue for async processing
    const job = await processQueue.add({
      operation: params.operation,
      data: params.data,
      userId: context.user?.id
    });
    
    return {
      text: 'Operation queued for processing',
      data: {
        jobId: job.id,
        status: 'queued'
      }
    };
  } else {
    // Synchronous processing
    const result = await performLongRunningOperation(params.operation, params.data);
    
    return {
      text: 'Operation completed',
      data: result
    };
  }
});

// Job status tool
server.addTool({
  name: 'job_status',
  description: 'Check job status',
  inputSchema: {
    type: 'object',
    properties: {
      jobId: { type: 'string' }
    },
    required: ['jobId']
  }
}, async (params, context) => {
  const job = await processQueue.getJob(params.jobId);
  
  if (!job) {
    throw new Error('Job not found');
  }
  
  return {
    text: 'Job status retrieved',
    data: {
      id: job.id,
      status: await job.getState(),
      progress: job.progress(),
      result: job.returnvalue
    }
  };
});
```

## Advanced Tool Patterns

### Tool Composition

```typescript
// Base tool class
abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: any;
  
  async execute(params: any, context: ToolContext): Promise<any> {
    await this.validate(params);
    await this.authorize(context);
    return await this.process(params, context);
  }
  
  protected async validate(params: any): Promise<void> {
    // Base validation
  }
  
  protected async authorize(context: ToolContext): Promise<void> {
    // Base authorization
  }
  
  protected abstract process(params: any, context: ToolContext): Promise<any>;
}

// Concrete tool implementation
class UserManagementTool extends BaseTool {
  name = 'user_management';
  description = 'Manage user accounts';
  inputSchema = {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'update', 'delete'] },
      userData: { type: 'object' }
    },
    required: ['action']
  };
  
  protected async authorize(context: ToolContext): Promise<void> {
    super.authorize(context);
    
    if (!context.user?.roles.includes('admin')) {
      throw new Error('Admin access required');
    }
  }
  
  protected async process(params: any, context: ToolContext): Promise<any> {
    switch (params.action) {
      case 'create':
        return await this.createUser(params.userData);
      case 'update':
        return await this.updateUser(params.userData);
      case 'delete':
        return await this.deleteUser(params.userData);
      default:
        throw new Error('Unknown action');
    }
  }
  
  private async createUser(userData: any): Promise<any> {
    // Implementation
  }
  
  private async updateUser(userData: any): Promise<any> {
    // Implementation
  }
  
  private async deleteUser(userData: any): Promise<any> {
    // Implementation
  }
}

// Register tool
const userTool = new UserManagementTool();
server.addTool(userTool, userTool.execute.bind(userTool));
```

### Tool Middleware

```typescript
// Middleware type
type ToolMiddleware = (params: any, context: ToolContext, next: Function) => Promise<any>;

// Middleware implementations
const authMiddleware: ToolMiddleware = async (params, context, next) => {
  if (!context.user) {
    throw new Error('Authentication required');
  }
  return next();
};

const rateLimitMiddleware: ToolMiddleware = async (params, context, next) => {
  const key = `rate_limit_${context.user?.id || 'anonymous'}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 60); // 1 minute window
  }
  
  if (count > 10) {
    throw new Error('Rate limit exceeded');
  }
  
  return next();
};

const loggingMiddleware: ToolMiddleware = async (params, context, next) => {
  const start = Date.now();
  console.log(`Tool ${context.tool} started`);
  
  try {
    const result = await next();
    console.log(`Tool ${context.tool} completed in ${Date.now() - start}ms`);
    return result;
  } catch (error) {
    console.error(`Tool ${context.tool} failed after ${Date.now() - start}ms:`, error);
    throw error;
  }
};

// Tool with middleware
function withMiddleware(middlewares: ToolMiddleware[], handler: Function) {
  return async (params: any, context: ToolContext) => {
    let index = 0;
    
    const next = async () => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        return middleware(params, context, next);
      } else {
        return handler(params, context);
      }
    };
    
    return next();
  };
}

// Use middleware
server.addTool({
  name: 'protected_tool',
  description: 'Tool with middleware',
  inputSchema: { /* schema */ }
}, withMiddleware([
  authMiddleware,
  rateLimitMiddleware,
  loggingMiddleware
], async (params, context) => {
  // Tool logic
  return { text: 'Tool executed successfully' };
}));
```

## Testing Tools

### Unit Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MCPServer } from '@tylercoles/mcp-server';

describe('User Management Tool', () => {
  let server: MCPServer;
  
  beforeEach(() => {
    server = new MCPServer({
      name: 'test-server',
      version: '1.0.0'
    });
    
    // Add the tool
    server.addTool({
      name: 'user_management',
      description: 'Test user management',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          userId: { type: 'string' }
        },
        required: ['action']
      }
    }, async (params, context) => {
      // Mock implementation
      return { text: `Action ${params.action} completed` };
    });
  });
  
  it('should execute tool successfully', async () => {
    const mockContext = {
      user: { id: 'test-user', roles: ['admin'] },
      request: { id: '123', timestamp: new Date(), transport: 'test' },
      server
    };
    
    const result = await server.callTool('user_management', {
      action: 'create'
    }, mockContext);
    
    expect(result.text).toBe('Action create completed');
  });
  
  it('should handle authentication errors', async () => {
    const mockContext = {
      user: null,
      request: { id: '123', timestamp: new Date(), transport: 'test' },
      server
    };
    
    await expect(
      server.callTool('user_management', { action: 'create' }, mockContext)
    ).rejects.toThrow('Authentication required');
  });
});
```

### Integration Testing

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPServer } from '@tylercoles/mcp-server';
import { HttpTransport } from '@tylercoles/mcp-transport-http';
import request from 'supertest';

describe('Tool Integration Tests', () => {
  let server: MCPServer;
  let httpTransport: HttpTransport;
  let app: any;
  
  beforeAll(async () => {
    server = new MCPServer({
      name: 'integration-test-server',
      version: '1.0.0'
    });
    
    // Add test tools
    server.addTool({
      name: 'echo',
      description: 'Echo tool for testing',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      }
    }, async (params) => {
      return { text: params.message };
    });
    
    httpTransport = new HttpTransport({ port: 3001 });
    server.useTransport(httpTransport);
    
    await server.start();
    app = httpTransport.app;
  });
  
  afterAll(async () => {
    await server.stop();
  });
  
  it('should execute tool via HTTP', async () => {
    const response = await request(app)
      .post('/tools/echo')
      .send({ message: 'Hello, World!' });
    
    expect(response.status).toBe(200);
    expect(response.body.text).toBe('Hello, World!');
  });
  
  it('should handle validation errors', async () => {
    const response = await request(app)
      .post('/tools/echo')
      .send({}); // Missing required message
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('message');
  });
});
```

## Best Practices

### Code Organization

```typescript
// tools/userManagement.ts
export class UserManagementTool {
  static register(server: MCPServer) {
    server.addTool({
      name: 'user_management',
      description: 'Manage user accounts',
      inputSchema: this.getSchema()
    }, this.handler.bind(this));
  }
  
  static getSchema() {
    return {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'delete'] },
        userData: { type: 'object' }
      },
      required: ['action']
    };
  }
  
  static async handler(params: any, context: ToolContext) {
    // Implementation
  }
}

// main.ts
import { UserManagementTool } from './tools/userManagement';

const server = new MCPServer({
  name: 'my-server',
  version: '1.0.0'
});

UserManagementTool.register(server);
```

### Performance Monitoring

```typescript
// Add performance monitoring to tools
server.addTool({
  name: 'monitored_tool',
  description: 'Tool with performance monitoring',
  inputSchema: { /* schema */ }
}, async (params, context) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  try {
    const result = await performOperation(params);
    
    // Log performance metrics
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    
    console.log('Tool performance:', {
      tool: 'monitored_tool',
      duration: endTime - startTime,
      memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
      user: context.user?.id
    });
    
    return result;
    
  } catch (error) {
    // Log error metrics
    console.error('Tool error:', {
      tool: 'monitored_tool',
      error: error.message,
      duration: Date.now() - startTime,
      user: context.user?.id
    });
    
    throw error;
  }
});
```

## Next Steps

- [Authentication Guide](authentication.md) - Add authentication to your tools
- [Transport Guide](transports.md) - Learn about different transport options
- [Deployment Guide](deployment.md) - Deploy your tools to production
- [Examples](../examples/) - Advanced tool examples