import { StdioTransport } from '../src';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPServer } from '@tylercoles/mcp-server';
import { Readable, Writable } from 'stream';

// Mock the SDK's stdio transport
const mockSDKTransport = {
  onclose: null,
  close: vi.fn()
};

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(() => mockSDKTransport)
}));

describe('StdioTransport', () => {
  let transport: StdioTransport;
  let server: MCPServer;
  let mockStdin: Readable;
  let mockStdout: Writable;
  let mockStderr: Writable;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock streams
    mockStdin = new Readable({ read() {} });
    mockStdout = new Writable({ write: vi.fn() });
    mockStderr = new Writable({ write: vi.fn() });

    // Mock process streams
    Object.defineProperty(process, 'stdin', { value: mockStdin, writable: true });
    Object.defineProperty(process, 'stdout', { value: mockStdout, writable: true });
    Object.defineProperty(process, 'stderr', { value: mockStderr, writable: true });

    // Create test server
    server = {
      getSDKServer: vi.fn().mockReturnValue({
        connect: vi.fn().mockResolvedValue(undefined)
      })
    } as any;
  });

  afterEach(() => {
    // Cleanup
    mockStdin.destroy();
    mockStdout.destroy();
    mockStderr.destroy();
  });

  describe('Construction', () => {
    it('should create with default config', () => {
      transport = new StdioTransport();
      expect(transport).toBeDefined();
    });

    it('should create with custom config', () => {
      transport = new StdioTransport({ logStderr: true });
      expect(transport).toBeDefined();
    });
  });

  describe('Start', () => {
    it('should connect SDK server to stdio transport', async () => {
      transport = new StdioTransport();
      const sdkServer = server.getSDKServer();
      
      await transport.start(server);
      
      expect(sdkServer.connect).toHaveBeenCalledWith(mockSDKTransport);
    });

    it('should log to stderr when enabled', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation();
      transport = new StdioTransport({ logStderr: true });
      
      await transport.start(server);
      
      expect(consoleError).toHaveBeenCalledWith('[StdioTransport] Server connected successfully');
      consoleError.mockRestore();
    });

    it('should not log when logging disabled', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation();
      transport = new StdioTransport({ logStderr: false });
      
      await transport.start(server);
      
      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('should throw if already started', async () => {
      transport = new StdioTransport();
      await transport.start(server);
      
      await expect(transport.start(server)).rejects.toThrow('Transport already started');
    });

    it('should handle connection errors', async () => {
      transport = new StdioTransport();
      const sdkServer = server.getSDKServer();
      (sdkServer.connect as jest.Mock).mockRejectedValue(new Error('Connection failed'));
      
      await expect(transport.start(server)).rejects.toThrow('Connection failed');
    });
  });

  describe('Stop', () => {
    it('should handle stop gracefully', async () => {
      transport = new StdioTransport();
      await transport.start(server);
      
      await transport.stop();
      
      // Transport should clean up without errors
      expect(transport['transport']).toBeNull();
    });

    it('should handle stop when not started', async () => {
      transport = new StdioTransport();
      
      await expect(transport.stop()).resolves.toBeUndefined();
    });

    it('should handle close errors gracefully', async () => {
      transport = new StdioTransport();
      await transport.start(server);
      
      mockSDKTransport.close.mockImplementation(() => {
        throw new Error('Close failed');
      });
      
      // Should not throw
      await expect(transport.stop()).resolves.toBeUndefined();
    });

    it('should clear transport reference', async () => {
      transport = new StdioTransport();
      await transport.start(server);
      await transport.stop();
      
      // Should be able to start again
      await expect(transport.start(server)).resolves.toBeUndefined();
    });
  });

  describe('Logging', () => {
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
      consoleError = vi.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleError.mockRestore();
    });

    it('should prefix all log messages with [StdioTransport]', async () => {
      transport = new StdioTransport({ logStderr: true });
      await transport.start(server);
      
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[StdioTransport]')
      );
    });

    it('should log stop when enabled', async () => {
      transport = new StdioTransport({ logStderr: true });
      await transport.start(server);
      await transport.stop();
      
      expect(consoleError).toHaveBeenCalledWith('[StdioTransport] Stopped');
    });
  });

  describe('Integration', () => {
    it('should work with real MCPServer methods', async () => {
      // Create a more realistic server mock
      const realServer = {
        getSDKServer: vi.fn().mockReturnValue({
          connect: vi.fn().mockResolvedValue(undefined),
          name: 'test-server',
          version: '1.0.0'
        }),
        isStarted: vi.fn().mockReturnValue(false)
      } as any;

      transport = new StdioTransport();
      await transport.start(realServer);
      
      expect(realServer.getSDKServer).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle SDK transport creation errors', async () => {
      // Get the mocked module and mock it to throw
      const { StdioServerTransport } = await vi.importMock('@modelcontextprotocol/sdk/server/stdio.js');
      vi.mocked(StdioServerTransport).mockImplementationOnce(() => {
        throw new Error('Transport creation failed');
      });

      transport = new StdioTransport();
      await expect(transport.start(server)).rejects.toThrow('Transport creation failed');
    });

    it('should handle missing server methods gracefully', async () => {
      const badServer = {} as any;
      transport = new StdioTransport();
      
      await expect(transport.start(badServer)).rejects.toThrow();
    });
  });
});
