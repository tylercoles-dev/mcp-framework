import { 
  CallToolResult, 
  GetPromptResult,
  ReadResourceResult
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Simplified tool interface
 */
export interface ToolInfo {
  name: string;
  title?: string;
  description: string;
  inputSchema: any;
}

/**
 * Simplified resource interface
 */
export interface ResourceInfo {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

/**
 * Simplified prompt interface
 */
export interface PromptInfo {
  name: string;
  title?: string;
  description?: string;
  arguments?: any[];
}

/**
 * Base interface that all MCP clients must implement
 */
export interface IMCPClient {
  /**
   * Connect to the MCP server
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the MCP server
   */
  disconnect(): Promise<void>;

  /**
   * Check if client is connected
   */
  isConnected(): boolean;

  /**
   * List all available tools
   */
  listTools(): Promise<ToolInfo[]>;

  /**
   * Call a tool with arguments
   */
  callTool(name: string, args?: any): Promise<CallToolResult>;

  /**
   * List all available resources
   */
  listResources(): Promise<ResourceInfo[]>;

  /**
   * Read a resource by URI
   */
  readResource(uri: string): Promise<ReadResourceResult>;

  /**
   * List all available prompts
   */
  listPrompts(): Promise<PromptInfo[]>;

  /**
   * Get a prompt with arguments
   */
  getPrompt(name: string, args?: any): Promise<GetPromptResult>;

  /**
   * Get the underlying SDK client (for advanced usage)
   */
  getSDKClient(): any; // Using any to avoid SDK dependency in interface
}

/**
 * Abstract base class that provides common MCP client functionality
 */
export abstract class BaseMCPClient implements IMCPClient {
  protected connected = false;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract listTools(): Promise<ToolInfo[]>;
  abstract callTool(name: string, args?: any): Promise<CallToolResult>;
  abstract listResources(): Promise<ResourceInfo[]>;
  abstract readResource(uri: string): Promise<ReadResourceResult>;
  abstract listPrompts(): Promise<PromptInfo[]>;
  abstract getPrompt(name: string, args?: any): Promise<GetPromptResult>;
  abstract getSDKClient(): any;

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Ensure the client is connected before operations
   */
  protected ensureConnected(): void {
    if (!this.connected) {
      throw new Error("Client is not connected. Call connect() first.");
    }
  }
}

/**
 * Configuration interface for transport-specific clients
 */
export interface ClientConfig {
  // Base config properties that all transports might use
  timeout?: number;
  retries?: number;
  debug?: boolean;
}

/**
 * Factory interface for creating MCP clients
 */
export interface MCPClientFactory<TConfig extends ClientConfig = ClientConfig> {
  create(config: TConfig): IMCPClient;
  createAndConnect(config: TConfig): Promise<IMCPClient>;
}
