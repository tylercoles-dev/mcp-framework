import { vi } from 'vitest';

// Mock the SDK server globally for all tests
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    registerTool: vi.fn(),
    registerResource: vi.fn(),
    registerPrompt: vi.fn(),
    registerResourceTemplate: vi.fn(),
    notification: vi.fn(),
    setRequestHandler: vi.fn(),
    connect: vi.fn(),
    isStarted: false
  }))
}));

// Suppress console errors during tests
vi.spyOn(console, 'error').mockImplementation(() => {});