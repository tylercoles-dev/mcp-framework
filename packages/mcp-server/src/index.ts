import { ResourceMetadata, McpServer as SDKMcpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol";
import { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types";
import { z, ZodRawShape, ZodTypeAny } from "zod";
import { MCPErrorFactory, MCPErrorClass, MCPError, MCPErrorCode } from "./errors.js";

/**
 * MCP Notification interfaces
 */
export interface ProgressNotification {
  method: 'notifications/progress';
  params: {
    progressToken: string | number;
    progress: number;
    total?: number;
    message?: string;
  };
}

export interface LoggingNotification {
  method: 'notifications/message';
  params: {
    level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
    logger?: string;
    data: any;
  };
}

export interface CancellationNotification {
  method: 'notifications/cancelled';
  params: {
    requestId: string;
    reason?: string;
  };
}

export interface ResourceListChangedNotification {
  method: 'notifications/resources/list_changed';
  params?: {};
}

export interface ResourceUpdatedNotification {
  method: 'notifications/resources/updated';
  params: {
    uri: string;
  };
}

export interface ToolListChangedNotification {
  method: 'notifications/tools/list_changed';
  params?: {};
}

export interface PromptListChangedNotification {
  method: 'notifications/prompts/list_changed';
  params?: {};
}

/**
 * Transport interface that all transports must implement
 */
export interface Transport {
  start(server: MCPServer): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Tool handler context passed to all tool handlers
 */
export interface ToolContext {
  user?: any;
  requestId?: string;
  [key: string]: any;
}

/**
 * Tool handler function type
 */
export type ToolHandler<InputArgs extends ZodRawShape> = (
  args: z.infer<z.ZodObject<InputArgs>>,
  context: ToolContext
) => Promise<CallToolResult>;

/**
 * Tool configuration
 */
export interface ToolConfig<InputArgs extends ZodRawShape> {
  title?: string;
  description: string;
  inputSchema: InputArgs; // Zod schema or plain object
}

/**
 * Resource configuration
 */
export interface ResourceConfig {
  title?: string;
  description?: string;
  mimeType?: string;
}

/**
 * Resource handler function type
 */
export type ResourceHandler = (uri: URL, params?: any) => Promise<{
  contents: Array<{
    uri: string;
    text?: string;
    blob?: string;
    mimeType?: string;
  }>;
}>;

/**
 * Prompt configuration
 */
export interface PromptConfig {
  title?: string;
  description?: string;
  argsSchema?: any; // Zod schema or plain object
}

/**
 * Prompt handler function type
 */
export type PromptHandler<T = any> = (args: T) => {
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
};

/**
 * Server configuration
 */
export interface ServerConfig {
  name: string;
  version: string;
  capabilities?: object;
}

/**
 * Core MCP Server framework class
 * Provides a plugin architecture for transports and tools
 */
/**
 * Tool information
 */
export interface ToolInfo {
  name: string;
  title?: string;
  description: string;
  inputSchema: any;
}

/**
 * Resource information
 */
export interface ResourceInfo {
  name: string;
  uri: string;
  title?: string;
  description?: string;
  mimeType?: string;
}

/**
 * Prompt information
 */
export interface PromptInfo {
  name: string;
  title?: string;
  description?: string;
  arguments?: any[];
}

export class MCPServer {
  private config: ServerConfig;
  private sdkServer: SDKMcpServer;
  private transports: Transport[] = [];
  private context: ToolContext = {};
  private started = false;

  // Track registered items for introspection
  private tools: Map<string, ToolInfo> = new Map();
  private resources: Map<string, ResourceInfo> = new Map();
  private prompts: Map<string, PromptInfo> = new Map();

  constructor(config: ServerConfig) {
    this.config = config;
    this.sdkServer = new SDKMcpServer({
      name: config.name,
      version: config.version,
      capabilities: config.capabilities
    });
  }

  /**
   * Add a transport to this server (supports multiple transports)
   */
  useTransport(transport: Transport): void {
    if (this.started) {
      throw new Error('Cannot add transport after server has started');
    }
    this.transports.push(transport);
  }

  /**
   * Add multiple transports at once
   */
  useTransports(...transports: Transport[]): void {
    transports.forEach(t => this.useTransport(t));
  }

  /**
   * Set or update the context that will be passed to all tool handlers
   */
  setContext(context: Partial<ToolContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Get the current context
   */
  getContext(): ToolContext {
    return { ...this.context };
  }

  /**
   * Register a tool with the server
   */
  registerTool<InputArgs extends ZodRawShape>(
    name: string,
    config: ToolConfig<InputArgs>,
    handler: ToolHandler<InputArgs>
  ): void {
    // Validate tool name
    if (!name || typeof name !== 'string') {
      throw MCPErrorFactory.invalidParams('Tool name must be a non-empty string');
    }

    // Check if tool already exists
    if (this.tools.has(name)) {
      throw MCPErrorFactory.invalidParams(`Tool '${name}' is already registered`);
    }

    // Track tool info
    this.tools.set(name, {
      name,
      title: config.title,
      description: config.description,
      inputSchema: config.inputSchema
    });

    // Create the tool config object for SDK
    const toolConfig: any = {
      description: config.description,
      inputSchema: config.inputSchema
    };
    
    if (config.title) {
      toolConfig.title = config.title;
    }

    this.sdkServer.registerTool(
      name,
      toolConfig,
      async (args: any, extra: any) => {
        try {
          return await handler(args, this.getContext());
        } catch (error) {
          // Convert any error to MCP error format
          const mcpError = MCPErrorFactory.fromError(error);
          throw mcpError;
        }
      }
    );

    // Notify that tool list has changed
    if (this.started) {
      this.sendToolListChangedNotification().catch(err => {
        console.error('Failed to send tool list changed notification:', err);
      });
    }
  }

  /**
   * Register a resource with the server
   */
  registerResource(
    name: string,
    uriTemplate: string | any, // String or ResourceTemplate
    config: Omit<ResourceInfo, "name" | "uri">,
    handler: ResourceHandler
  ): void {
    // Validate resource name
    if (!name || typeof name !== 'string') {
      throw MCPErrorFactory.invalidParams('Resource name must be a non-empty string');
    }

    // Check if resource already exists
    if (this.resources.has(name)) {
      throw MCPErrorFactory.invalidParams(`Resource '${name}' is already registered`);
    }

    // Track resource info
    this.resources.set(name, {
      name,
      uri: typeof uriTemplate === 'string' ? uriTemplate : uriTemplate.uriTemplate,
      title: config.title,
      description: config.description,
      mimeType: config.mimeType
    });

    // Wrap handler with error handling
    const wrappedHandler = async (uri: URL, params?: any) => {
      try {
        return await handler(uri, params);
      } catch (error) {
        // Convert any error to MCP error format
        const mcpError = MCPErrorFactory.fromError(error);
        throw mcpError;
      }
    };

    this.sdkServer.registerResource(name, uriTemplate, config as any, wrappedHandler as any);

    // Notify that resource list has changed
    if (this.started) {
      this.sendResourceListChangedNotification().catch(err => {
        console.error('Failed to send resource list changed notification:', err);
      });
    }
  }

  /**
   * Register a prompt with the server
   */
  registerPrompt<T = any>(
    name: string,
    config: PromptConfig,
    handler: PromptHandler<T>
  ): void {
    // Validate prompt name
    if (!name || typeof name !== 'string') {
      throw MCPErrorFactory.invalidParams('Prompt name must be a non-empty string');
    }

    // Check if prompt already exists
    if (this.prompts.has(name)) {
      throw MCPErrorFactory.invalidParams(`Prompt '${name}' is already registered`);
    }

    // Track prompt info
    this.prompts.set(name, {
      name,
      title: config.title,
      description: config.description,
      arguments: config.argsSchema ? Object.keys(config.argsSchema) : []
    });

    // Create the prompt config object for SDK
    const promptConfig: any = {};
    
    if (config.title) {
      promptConfig.title = config.title;
    }
    if (config.description) {
      promptConfig.description = config.description;
    }
    if (config.argsSchema) {
      promptConfig.argsSchema = config.argsSchema;
    }

    // Wrap handler with error handling
    const wrappedHandler = async (args: T) => {
      try {
        return handler(args);
      } catch (error) {
        // Convert any error to MCP error format
        const mcpError = MCPErrorFactory.fromError(error);
        throw mcpError;
      }
    };

    // Pass through to SDK's registerPrompt
    this.sdkServer.registerPrompt(
      name,
      promptConfig,
      wrappedHandler as any
    );

    // Notify that prompt list has changed
    if (this.started) {
      this.sendPromptListChangedNotification().catch(err => {
        console.error('Failed to send prompt list changed notification:', err);
      });
    }
  }

  /**
   * Get the underlying SDK server instance
   * This allows transports to access the raw server for connection
   */
  getSDKServer(): SDKMcpServer {
    return this.sdkServer;
  }

  /**
   * Send a progress notification for long-running operations
   */
  async sendProgressNotification(
    progressToken: string | number,
    progress: number,
    total?: number,
    message?: string
  ): Promise<void> {
    await this.sdkServer.notification({
      method: 'notifications/progress',
      params: {
        progressToken,
        progress,
        total,
        message
      }
    });
  }

  /**
   * Send a logging notification
   */
  async sendLogNotification(
    level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency',
    data: any,
    logger?: string
  ): Promise<void> {
    await this.sdkServer.notification({
      method: 'notifications/message',
      params: {
        level,
        logger,
        data
      }
    });
  }

  /**
   * Send a cancellation notification
   */
  async sendCancellationNotification(
    requestId: string,
    reason?: string
  ): Promise<void> {
    await this.sdkServer.notification({
      method: 'notifications/cancelled',
      params: {
        requestId,
        reason
      }
    });
  }

  /**
   * Send notification that resource list has changed
   */
  async sendResourceListChangedNotification(): Promise<void> {
    await this.sdkServer.notification({
      method: 'notifications/resources/list_changed',
      params: {}
    });
  }

  /**
   * Send notification that a resource has been updated
   */
  async sendResourceUpdatedNotification(uri: string): Promise<void> {
    await this.sdkServer.notification({
      method: 'notifications/resources/updated',
      params: {
        uri
      }
    });
  }

  /**
   * Send notification that tool list has changed
   */
  async sendToolListChangedNotification(): Promise<void> {
    await this.sdkServer.notification({
      method: 'notifications/tools/list_changed',
      params: {}
    });
  }

  /**
   * Send notification that prompt list has changed
   */
  async sendPromptListChangedNotification(): Promise<void> {
    await this.sdkServer.notification({
      method: 'notifications/prompts/list_changed',
      params: {}
    });
  }

  /**
   * Start the server with all configured transports
   */
  async start(): Promise<void> {
    if (this.transports.length === 0) {
      throw new Error('No transports configured. Use useTransport() to add transports.');
    }

    if (this.started) {
      throw new Error('Server has already been started');
    }

    // Start all transports
    await Promise.all(this.transports.map(t => t.start(this)));
    this.started = true;
  }

  /**
   * Stop the server and all transports
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // Stop all transports
    await Promise.all(this.transports.map(t => t.stop()));

    this.started = false;
  }

  /**
   * Check if the server is running
   */
  isStarted(): boolean {
    return this.started;
  }

  /**
   * Get information about all registered tools
   */
  getTools(): ToolInfo[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get information about a specific tool
   */
  getTool(name: string): ToolInfo | undefined {
    if (!name || typeof name !== 'string') {
      throw MCPErrorFactory.invalidParams('Tool name must be a non-empty string');
    }
    return this.tools.get(name);
  }

  /**
   * Get information about all registered resources
   */
  getResources(): ResourceInfo[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get information about a specific resource
   */
  getResource(name: string): ResourceInfo | undefined {
    if (!name || typeof name !== 'string') {
      throw MCPErrorFactory.invalidParams('Resource name must be a non-empty string');
    }
    return this.resources.get(name);
  }

  /**
   * Get information about all registered prompts
   */
  getPrompts(): PromptInfo[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Get information about a specific prompt
   */
  getPrompt(name: string): PromptInfo | undefined {
    if (!name || typeof name !== 'string') {
      throw MCPErrorFactory.invalidParams('Prompt name must be a non-empty string');
    }
    return this.prompts.get(name);
  }

  /**
   * Get a summary of all registered capabilities
   */
  getCapabilities(): {
    tools: ToolInfo[];
    resources: ResourceInfo[];
    prompts: PromptInfo[];
  } {
    return {
      tools: this.getTools(),
      resources: this.getResources(),
      prompts: this.getPrompts()
    };
  }
}

// Re-export common types from the SDK
export { z } from "zod";
export type { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

// Re-export error types
export {
  MCPErrorFactory,
  MCPErrorClass,
  MCPErrorCode,
  isMCPError,
  formatMCPError
} from "./errors.js";
export type { MCPError } from "./errors.js";
