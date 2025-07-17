import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { 
  CallToolResult, 
  GetPromptResult,
  ReadResourceResult,
  JSONRPCMessage,
  JSONRPCResponse
} from "@modelcontextprotocol/sdk/types.js";
import { 
  BaseMCPClient, 
  ClientConfig, 
  ToolInfo, 
  ResourceInfo, 
  PromptInfo,
  MCPClientFactory,
  ConnectionState
} from "@tylercoles/mcp-client";

/**
 * Configuration for stdio MCP client
 */
export interface StdioClientConfig extends ClientConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * MCP Client for stdio transport
 * Provides a clean TypeScript interface for communicating with stdio MCP servers
 */
export class StdioMCPClient extends BaseMCPClient {
  private client: Client;
  private transport: StdioClientTransport;
  private stdioConfig: StdioClientConfig;

  constructor(config: StdioClientConfig) {
    super(config);
    this.stdioConfig = config;
    this.transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: config.env,
      cwd: config.cwd
    });

    this.client = new Client({
      name: "stdio-mcp-client",
      version: "1.0.0"
    });
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.isConnected()) {
      throw new Error("Client is already connected");
    }

    await this.client.connect(this.transport);
    this.setConnectionState(ConnectionState.Connected);
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected()) {
      return;
    }

    await this.client.close();
    this.setConnectionState(ConnectionState.Disconnected);
  }

  /**
   * List all available tools
   */
  async listTools(): Promise<ToolInfo[]> {
    if (!this.isConnected()) {
      throw new Error("Client is not connected");
    }
    const result = await this.client.listTools();
    return result.tools.map(tool => ({
      name: tool.name,
      title: tool.title,
      description: tool.description || '',
      inputSchema: tool.inputSchema
    }));
  }

  /**
   * Call a tool with arguments (implementation for doCallTool)
   */
  protected async doCallTool(name: string, args?: any): Promise<CallToolResult> {
    if (!this.isConnected()) {
      throw new Error("Client is not connected");
    }
    const result = await this.client.callTool({
      name,
      arguments: args || {}
    });
    return result as CallToolResult;
  }

  /**
   * List all available resources
   */
  async listResources(): Promise<ResourceInfo[]> {
    if (!this.isConnected()) {
      throw new Error("Client is not connected");
    }
    const result = await this.client.listResources();
    return result.resources.map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType
    }));
  }

  /**
   * Read a resource by URI
   */
  async readResource(uri: string): Promise<ReadResourceResult> {
    if (!this.isConnected()) {
      throw new Error("Client is not connected");
    }
    return await this.client.readResource({ uri });
  }

  /**
   * List all available prompts
   */
  async listPrompts(): Promise<PromptInfo[]> {
    if (!this.isConnected()) {
      throw new Error("Client is not connected");
    }
    const result = await this.client.listPrompts();
    return result.prompts.map(prompt => ({
      name: prompt.name,
      title: prompt.title,
      description: prompt.description,
      arguments: prompt.arguments
    }));
  }

  /**
   * Get a prompt with arguments
   */
  async getPrompt(name: string, args?: any): Promise<GetPromptResult> {
    if (!this.isConnected()) {
      throw new Error("Client is not connected");
    }
    return await this.client.getPrompt({
      name,
      arguments: args || {}
    });
  }

  /**
   * Get the underlying SDK client (for advanced usage)
   */
  getSDKClient(): Client {
    return this.client;
  }

  /**
   * Send a JSON-RPC message directly
   */
  async sendMessage(message: JSONRPCMessage): Promise<JSONRPCResponse | void> {
    if (!this.isConnected()) {
      throw new Error("Client is not connected");
    }
    // For stdio transport, we don't have direct message sending capability
    // This would need to be implemented based on the actual transport API
    throw new Error("Direct message sending not supported for stdio transport");
  }

  /**
   * Send heartbeat ping
   */
  protected async sendHeartbeat(): Promise<void> {
    // Stdio transport doesn't typically need heartbeat
    // This is a no-op for stdio clients
  }
}

/**
 * Factory for creating stdio MCP clients
 */
export class StdioMCPClientFactory implements MCPClientFactory<StdioClientConfig> {
  create(config: StdioClientConfig): StdioMCPClient {
    return new StdioMCPClient(config);
  }

  async createAndConnect(config: StdioClientConfig): Promise<StdioMCPClient> {
    const client = new StdioMCPClient(config);
    await client.connect();
    return client;
  }
}

/**
 * Utility function to create and connect a stdio MCP client
 */
export async function createStdioMCPClient(config: StdioClientConfig): Promise<StdioMCPClient> {
  const factory = new StdioMCPClientFactory();
  return await factory.createAndConnect(config);
}
