-- PostgreSQL initialization script for Kanban Board
-- Create useful extensions for the application

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable full-text search capabilities
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enable fuzzy string matching
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";

-- Enable additional statistics
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create indexes for better performance
-- These will be created after the main schema is loaded

-- Set timezone
SET timezone = 'UTC';

-- Create application user with proper permissions
-- (This user is already created by POSTGRES_USER, but we can set additional permissions)

-- Grant necessary permissions
GRANT CONNECT ON DATABASE kanban_db TO kanban_user;
GRANT USAGE ON SCHEMA public TO kanban_user;
GRANT CREATE ON SCHEMA public TO kanban_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kanban_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO kanban_user;