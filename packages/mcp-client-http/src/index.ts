import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { 
  CallToolResult, 
  GetPromptResult,
  ReadResourceResult
} from "@modelcontextprotocol/sdk/types.js";
import { 
  BaseMCPClient, 
  ClientConfig, 
  ToolInfo, 
  ResourceInfo, 
  PromptInfo,
  MCPClientFactory
} from "@tylercoles/mcp-client";

/**
 * Configuration for HTTP MCP client
 */
export interface HttpClientConfig extends ClientConfig {
  url: string;
  headers?: Record<string, string>;
}

/**
 * MCP Client for StreamableHTTP transport
 * Provides a clean TypeScript interface for communicating with HTTP MCP servers
 */
export class HttpMCPClient extends BaseMCPClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport;

  constructor(private config: HttpClientConfig) {
    super();
    this.transport = new StreamableHTTPClientTransport(
      new URL(config.url)
    );

    this.client = new Client({
      name: "http-mcp-client",
      version: "1.0.0"
    });
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error("Client is already connected");
    }

    await this.client.connect(this.transport);
    this.connected = true;
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await this.client.close();
    this.connected = false;
  }

  /**
   * List all available tools
   */
  async listTools(): Promise<ToolInfo[]> {
    this.ensureConnected();
    const result = await this.client.listTools();
    return result.tools.map(tool => ({
      name: tool.name,
      title: tool.title,
      description: tool.description || '',
      inputSchema: tool.inputSchema
    }));
  }

  /**
   * Call a tool with arguments
   */
  async callTool(name: string, args?: any): Promise<CallToolResult> {
    this.ensureConnected();
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
    this.ensureConnected();
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
    this.ensureConnected();
    return await this.client.readResource({ uri });
  }

  /**
   * List all available prompts
   */
  async listPrompts(): Promise<PromptInfo[]> {
    this.ensureConnected();
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
    this.ensureConnected();
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
   * Get the server URL
   */
  getServerUrl(): string {
    return this.config.url;
  }
}

/**
 * Factory for creating HTTP MCP clients
 */
export class HttpMCPClientFactory implements MCPClientFactory<HttpClientConfig> {
  create(config: HttpClientConfig): HttpMCPClient {
    return new HttpMCPClient(config);
  }

  async createAndConnect(config: HttpClientConfig): Promise<HttpMCPClient> {
    const client = new HttpMCPClient(config);
    await client.connect();
    return client;
  }
}

/**
 * Utility function to create and connect an HTTP MCP client
 */
export async function createHttpMCPClient(config: HttpClientConfig): Promise<HttpMCPClient> {
  const factory = new HttpMCPClientFactory();
  return await factory.createAndConnect(config);
}
