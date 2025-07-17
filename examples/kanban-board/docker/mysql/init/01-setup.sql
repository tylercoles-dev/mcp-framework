-- MySQL initialization script for Kanban Board
-- Set proper character set and collation

-- Ensure database uses UTF8MB4
ALTER DATABASE kanban_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Set timezone
SET time_zone = '+00:00';

-- Create indexes for better performance after schema is loaded
-- These will be added automatically by the application schema

-- Grant additional permissions to kanban_user
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER ON kanban_db.* TO 'kanban_user'@'%';

-- Flush privileges
FLUSH PRIVILEGES;