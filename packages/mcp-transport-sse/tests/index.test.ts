import { SSETransport } from "../src/index";
import { z } from "zod";

// Mock fetch since node-fetch v3 is ESM only
const mockFetch = jest.fn();
jest.mock("node-fetch", () => mockFetch);

describe("SSETransport", () => {
  let server: any;
  let transport: any;

  beforeEach(() => {
    // Mock MCP server
    server = {
      name: "test-server",
      version: "1.0.0",
      getSDKServer: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined)
      }),
      useTransport: jest.fn(),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      isStarted: jest.fn().mockReturnValue(false),
      registerTool: jest.fn(),
      getTool: jest.fn()
    };

    transport = new SSETransport({
      port: 0, // Use random port
      host: "127.0.0.1"
    });

    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(async () => {
    // Only stop if transport is still running
    if (transport && transport.server) {
      await transport.stop();
    }
  });

  test("should start and stop successfully", async () => {
    await transport.start(server);
    
    // Server should be listening
    const baseUrl = transport.getBaseUrl();
    expect(baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    
    // Stop will be called in afterEach
  });

  test("should get base URL", async () => {
    await transport.start(server);
    
    const baseUrl = transport.getBaseUrl();
    expect(baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//);
  });

  test("should track active sessions", () => {
    expect(transport.getSessionCount()).toBe(0);
  });

  test("should create with custom configuration", () => {
    const customTransport = new SSETransport({
      port: 3000,
      host: "localhost",
      enableDnsRebindingProtection: true,
      allowedHosts: ["localhost", "127.0.0.1"]
    });

    expect(customTransport).toBeDefined();
  });
});
