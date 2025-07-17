# Multi-stage build for production-ready kanban board MCP server
FROM node:18-alpine AS base

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

WORKDIR /app

# Copy package files for dependency resolution
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Development stage
FROM base AS development

# Install all dependencies including dev dependencies
RUN npm ci
RUN cd frontend && npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build
RUN npm run frontend:build

# Expose development port
EXPOSE 3001

# Development command with hot reload
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS build

# Install production dependencies first
RUN npm ci --only=production && npm cache clean --force
RUN cd frontend && npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build
RUN npm run frontend:build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    sqlite \
    postgresql-client \
    mysql-client \
    dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

# Copy package files
COPY --from=build /app/package*.json ./

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

# Copy database schema
COPY --from=build /app/src/database/schema.sql ./dist/database/schema.sql

# Create directories and set permissions
RUN mkdir -p /app/data /app/logs
RUN chown -R nextjs:nodejs /app

USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Expose port
EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Production command
CMD ["node", "dist/index.js"]