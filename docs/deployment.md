# Deployment Guide

This guide covers how to deploy MCP servers built with the framework to various environments including Docker, cloud platforms, and production servers.

## Production Checklist

### Security
- [ ] HTTPS enabled with valid SSL certificates
- [ ] Environment variables for secrets (not hardcoded)
- [ ] Authentication and authorization configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured for allowed origins only
- [ ] Security headers configured (Helmet.js)
- [ ] Input validation on all endpoints
- [ ] Error handling doesn't expose sensitive information

### Performance
- [ ] Connection pooling configured
- [ ] Rate limiting appropriate for your use case
- [ ] Monitoring and logging configured
- [ ] Health checks implemented
- [ ] Graceful shutdown handling
- [ ] Resource limits configured

### Reliability
- [ ] Error handling and recovery
- [ ] Health checks for load balancers
- [ ] Proper logging for debugging
- [ ] Backup and recovery procedures
- [ ] Database connection resilience (if applicable)

## Docker Deployment

### Basic Dockerfile

```dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcp -u 1001

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY --chown=mcp:nodejs . .

# Build the application
RUN npm run build

# Switch to non-root user
USER mcp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]
```

### Multi-stage Build

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY docs/ ./docs/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcp -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy any additional runtime files
COPY --chown=mcp:nodejs docs/ ./docs/

# Switch to non-root user
USER mcp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  mcp-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - OIDC_ISSUER=${OIDC_ISSUER}
      - OIDC_CLIENT_ID=${OIDC_CLIENT_ID}
      - OIDC_CLIENT_SECRET=${OIDC_CLIENT_SECRET}
      - SESSION_SECRET=${SESSION_SECRET}
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    depends_on:
      - redis
      - postgres
    networks:
      - mcp-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - mcp-network

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=mcp_server
      - POSTGRES_USER=mcp
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - mcp-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - mcp-server
    restart: unless-stopped
    networks:
      - mcp-network

volumes:
  redis_data:
  postgres_data:

networks:
  mcp-network:
    driver: bridge
```

### Production Environment Variables

```bash
# .env.production
NODE_ENV=production
PORT=3000

# Authentication
OIDC_ISSUER=https://auth.example.com
OIDC_CLIENT_ID=production-client-id
OIDC_CLIENT_SECRET=your-production-secret
OIDC_REDIRECT_URI=https://your-app.com/auth/callback

# Session
SESSION_SECRET=your-production-session-secret-should-be-very-long-and-random

# Database
DATABASE_URL=postgresql://mcp:password@postgres:5432/mcp_server

# Redis
REDIS_URL=redis://redis:6379

# SSL
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/key.pem

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
```

## Cloud Platform Deployment

### AWS ECS with Fargate

```yaml
# task-definition.json
{
  "family": "mcp-server",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "mcp-server",
      "image": "your-account.dkr.ecr.region.amazonaws.com/mcp-server:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "OIDC_CLIENT_SECRET",
          "valueFrom": "arn:aws:ssm:region:account:parameter/mcp/oidc-client-secret"
        },
        {
          "name": "SESSION_SECRET",
          "valueFrom": "arn:aws:ssm:region:account:parameter/mcp/session-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/mcp-server",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### Google Cloud Run

```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/mcp-server:$COMMIT_SHA'
      - '.'
  
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/mcp-server:$COMMIT_SHA'
  
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'mcp-server'
      - '--image'
      - 'gcr.io/$PROJECT_ID/mcp-server:$COMMIT_SHA'
      - '--platform'
      - 'managed'
      - '--region'
      - 'us-central1'
      - '--allow-unauthenticated'
      - '--memory'
      - '512Mi'
      - '--cpu'
      - '1'
      - '--concurrency'
      - '80'
      - '--timeout'
      - '300'
      - '--set-env-vars'
      - 'NODE_ENV=production'
      - '--set-secrets'
      - 'OIDC_CLIENT_SECRET=oidc-client-secret:latest'
      - '--set-secrets'
      - 'SESSION_SECRET=session-secret:latest'
```

### Azure Container Instances

```yaml
# azure-deploy.yaml
apiVersion: '2019-12-01'
location: eastus
name: mcp-server
properties:
  containers:
  - name: mcp-server
    properties:
      image: your-registry.azurecr.io/mcp-server:latest
      ports:
      - port: 3000
        protocol: TCP
      environmentVariables:
      - name: NODE_ENV
        value: production
      - name: PORT
        value: '3000'
      - name: OIDC_ISSUER
        value: https://auth.example.com
      - name: OIDC_CLIENT_ID
        value: azure-client-id
      - name: OIDC_CLIENT_SECRET
        secureValue: your-secret-value
      - name: SESSION_SECRET
        secureValue: your-session-secret
      resources:
        requests:
          cpu: 0.5
          memoryInGB: 1
      livenessProbe:
        httpGet:
          path: /health
          port: 3000
        initialDelaySeconds: 30
        periodSeconds: 30
  osType: Linux
  restartPolicy: Always
  ipAddress:
    type: Public
    ports:
    - port: 3000
      protocol: TCP
tags:
  environment: production
  service: mcp-server
```

## Kubernetes Deployment

### Deployment Configuration

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
  labels:
    app: mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-server
  template:
    metadata:
      labels:
        app: mcp-server
    spec:
      containers:
      - name: mcp-server
        image: your-registry/mcp-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: OIDC_ISSUER
          value: "https://auth.example.com"
        - name: OIDC_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: mcp-secrets
              key: oidc-client-id
        - name: OIDC_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: mcp-secrets
              key: oidc-client-secret
        - name: SESSION_SECRET
          valueFrom:
            secretKeyRef:
              name: mcp-secrets
              key: session-secret
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        securityContext:
          allowPrivilegeEscalation: false
          runAsNonRoot: true
          runAsUser: 1001
          capabilities:
            drop:
            - ALL
```

### Service Configuration

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: mcp-server-service
  labels:
    app: mcp-server
spec:
  selector:
    app: mcp-server
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
  type: ClusterIP
```

### Ingress Configuration

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mcp-server-ingress
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - api.example.com
    secretName: mcp-server-tls
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mcp-server-service
            port:
              number: 80
```

## Monitoring and Logging

### Health Checks

```typescript
import { MCPServer } from '@tylercoles/mcp-server';
import { HttpTransport } from '@tylercoles/mcp-transport-http';

const server = new MCPServer({
  name: 'production-server',
  version: '1.0.0'
});

const httpTransport = new HttpTransport({
  port: 3000,
  // Add health check endpoints
  healthCheck: {
    path: '/health',
    handler: async () => {
      // Check database connectivity
      // Check external services
      // Check memory usage
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
      };
    }
  },
  
  readinessCheck: {
    path: '/ready',
    handler: async () => {
      // Check if server is ready to accept requests
      return {
        status: 'ready',
        timestamp: new Date().toISOString()
      };
    }
  }
});

server.useTransport(httpTransport);
```

### Logging Configuration

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Add to server
server.setLogger(logger);
```

### Metrics Collection

```typescript
import { collectDefaultMetrics, register } from 'prom-client';

// Collect default metrics
collectDefaultMetrics();

// Add custom metrics
const httpTransport = new HttpTransport({
  port: 3000,
  middleware: [
    // Metrics middleware
    (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        // Record metrics
        httpRequestDuration.observe(
          { method: req.method, status: res.statusCode },
          duration
        );
      });
      
      next();
    }
  ]
});

// Metrics endpoint
server.addResource({
  uri: 'metrics://prometheus',
  name: 'Prometheus Metrics'
}, async () => {
  return {
    contents: [{
      uri: 'metrics://prometheus',
      mimeType: 'text/plain',
      text: await register.metrics()
    }]
  };
});
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
#!/bin/bash
# certbot-renew.sh

# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d api.example.com

# Add to crontab for auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### SSL Configuration

```typescript
import fs from 'fs';
import { HttpTransport } from '@tylercoles/mcp-transport-http';

const httpsOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/api.example.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/api.example.com/fullchain.pem')
};

const httpTransport = new HttpTransport({
  port: 443,
  httpsOptions,
  // Redirect HTTP to HTTPS
  redirectHttpToHttps: true
});
```

## Load Balancing

### Nginx Configuration

```nginx
# nginx.conf
upstream mcp_servers {
    server mcp-server-1:3000;
    server mcp-server-2:3000;
    server mcp-server-3:3000;
}

server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    
    location / {
        proxy_pass http://mcp_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    location /health {
        access_log off;
        proxy_pass http://mcp_servers;
    }
}
```

## Database Configuration

### PostgreSQL with Connection Pooling

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Add to server context
server.setContext({
  db: pool
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing database connections...');
  await pool.end();
  process.exit(0);
});
```

### Redis Session Store

```typescript
import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

const httpTransport = new HttpTransport({
  port: 3000,
  session: {
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }
});
```

## Backup and Recovery

### Database Backup Script

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="mcp_server"

# Create backup
pg_dump $DATABASE_URL > "$BACKUP_DIR/mcp_server_$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/mcp_server_$DATE.sql"

# Remove backups older than 7 days
find $BACKUP_DIR -name "mcp_server_*.sql.gz" -mtime +7 -delete

# Upload to S3 (optional)
aws s3 cp "$BACKUP_DIR/mcp_server_$DATE.sql.gz" s3://your-backup-bucket/
```

### Application State Backup

```typescript
// Add backup endpoint for application data
server.addTool({
  name: 'backup',
  description: 'Create application backup',
  inputSchema: {
    type: 'object',
    properties: {}
  }
}, async (params, context) => {
  if (!context.user?.roles?.includes('admin')) {
    throw new Error('Admin access required');
  }
  
  const backup = {
    timestamp: new Date().toISOString(),
    version: server.version,
    data: {
      // Export application data
    }
  };
  
  // Save to backup storage
  await saveBackup(backup);
  
  return {
    text: 'Backup created successfully',
    data: { backupId: backup.timestamp }
  };
});
```

## Troubleshooting Production Issues

### Common Issues and Solutions

1. **High Memory Usage**
   ```typescript
   // Monitor memory usage
   setInterval(() => {
     const memUsage = process.memoryUsage();
     if (memUsage.heapUsed > 400 * 1024 * 1024) { // 400MB
       console.warn('High memory usage detected:', memUsage);
     }
   }, 60000); // Check every minute
   ```

2. **Connection Pool Exhaustion**
   ```typescript
   // Monitor connection pool
   setInterval(() => {
     console.log('Pool stats:', {
       total: pool.totalCount,
       idle: pool.idleCount,
       waiting: pool.waitingCount
     });
   }, 30000);
   ```

3. **Authentication Issues**
   ```typescript
   // Add authentication debugging
   server.onError((error, context) => {
     if (error.message.includes('auth')) {
       console.error('Auth error:', {
         error: error.message,
         user: context.user?.id,
         timestamp: new Date().toISOString()
       });
     }
   });
   ```

### Performance Monitoring

```typescript
// Add performance monitoring
server.addTool({
  name: 'performance_stats',
  description: 'Get server performance statistics',
  inputSchema: { type: 'object' }
}, async (params, context) => {
  return {
    text: 'Performance statistics',
    data: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      activeConnections: server.getActiveConnections(),
      requestCount: server.getRequestCount()
    }
  };
});
```

## Next Steps

- [Monitoring Guide](monitoring.md) - Set up comprehensive monitoring
- [Security Best Practices](../SECURITY.md) - Security considerations
- [Performance Optimization](performance.md) - Optimize your deployment
- [Troubleshooting Guide](troubleshooting.md) - Common issues and solutions