-- Kanban Board Database Schema for PostgreSQL

-- Boards table
CREATE TABLE IF NOT EXISTS boards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    color VARCHAR(7) DEFAULT '#6366f1'
);

-- Columns table (represents swim lanes like "To Do", "In Progress", "Done")
CREATE TABLE IF NOT EXISTS columns (
    id SERIAL PRIMARY KEY,
    board_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(7) DEFAULT '#64748b',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    board_id INTEGER NOT NULL,
    column_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    priority VARCHAR(20) DEFAULT 'medium',
    assigned_to VARCHAR(255),
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#64748b',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Card tags junction table
CREATE TABLE IF NOT EXISTS card_tags (
    card_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (card_id, tag_id),
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- Insert default data only if tables are empty
INSERT INTO boards (id, name, description, color) VALUES 
(1, 'Sample Project', 'A sample kanban board to get started', '#6366f1'),
(2, 'Personal Tasks', 'Personal task management board', '#10b981')
ON CONFLICT (id) DO NOTHING;

INSERT INTO columns (id, board_id, name, position, color) VALUES 
(1, 1, 'To Do', 0, '#ef4444'),
(2, 1, 'In Progress', 1, '#f59e0b'),
(3, 1, 'Review', 2, '#3b82f6'),
(4, 1, 'Done', 3, '#10b981'),
(5, 2, 'Backlog', 0, '#6b7280'),
(6, 2, 'Active', 1, '#8b5cf6'),
(7, 2, 'Completed', 2, '#10b981')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tags (id, name, color) VALUES
(1, 'urgent', '#ef4444'),
(2, 'feature', '#3b82f6'),
(3, 'bug', '#f59e0b'),
(4, 'enhancement', '#10b981'),
(5, 'documentation', '#8b5cf6')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cards (id, board_id, column_id, title, description, position, priority, assigned_to) VALUES
(1, 1, 1, 'Setup project structure', 'Initialize the kanban board project with proper folder structure', 0, 'high', 'Developer'),
(2, 1, 1, 'Design database schema', 'Create tables for boards, columns, cards, and tags', 1, 'high', 'Developer'),
(3, 1, 2, 'Implement MCP server', 'Build the MCP server with tools and resources for kanban management', 0, 'high', 'Developer'),
(4, 1, 3, 'Create React frontend', 'Build a basic web UI for managing the kanban board', 0, 'medium', 'Frontend Dev'),
(5, 2, 5, 'Learn MCP protocol', 'Study the Model Context Protocol specification', 0, 'medium', 'Self'),
(6, 2, 6, 'Practice TypeScript', 'Improve TypeScript skills for better development', 0, 'low', 'Self')
ON CONFLICT (id) DO NOTHING;

INSERT INTO card_tags (card_id, tag_id) VALUES
(1, 2), -- Setup project structure -> feature
(2, 2), -- Design database schema -> feature  
(3, 2), -- Implement MCP server -> feature
(4, 2), -- Create React frontend -> feature
(5, 5), -- Learn MCP protocol -> documentation
(6, 4)  -- Practice TypeScript -> enhancement
ON CONFLICT (card_id, tag_id) DO NOTHING;

-- Fix sequence values to match the inserted data
SELECT setval('boards_id_seq', (SELECT MAX(id) FROM boards));
SELECT setval('columns_id_seq', (SELECT MAX(id) FROM columns));
SELECT setval('cards_id_seq', (SELECT MAX(id) FROM cards));
SELECT setval('tags_id_seq', (SELECT MAX(id) FROM tags));
SELECT setval('comments_id_seq', (SELECT MAX(id) FROM comments));