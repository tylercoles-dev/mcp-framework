import { vi } from 'vitest';

// Mock the SDK server globally for all tests
const mockSDKServer = {
  registerTool: vi.fn(),
  registerResource: vi.fn(),
  registerPrompt: vi.fn(),
  registerResourceTemplate: vi.fn(),
  notification: vi.fn(),
  setRequestHandler: vi.fn(),
  connect: vi.fn(),
  isStarted: false,
  server: {
    notification: vi.fn(),
    setRequestHandler: vi.fn()
  }
};

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => mockSDKServer),
  ResourceTemplate: vi.fn().mockImplementation((uriTemplate, config) => ({
    uriTemplate,
    config
  }))
}));

// Suppress console errors during tests
vi.spyOn(console, 'error').mockImplementation(() => {});