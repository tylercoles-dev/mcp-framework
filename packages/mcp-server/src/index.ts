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
 * Resource template interface for dynamic resources
 */
export interface ResourceTemplate {
  uriTemplate: string; // e.g., "file:///users/{userId}/documents/{docId}"
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: Record<string, any>;
}

/**
 * Resource template configuration
 */
export interface ResourceTemplateConfig {
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: Record<string, any>;
  parameterSchema?: Record<string, any>; // JSON schema for template parameters
}

/**
 * Resource template handler function type
 */
export type ResourceTemplateHandler = (
  uri: URL,
  params: Record<string, string>,
  templateParams?: Record<string, any>
) => Promise<{
  contents: Array<{
    uri: string;
    text?: string;
    blob?: string;
    mimeType?: string;
  }>;
}>;

/**
 * Resource template information
 */
export interface ResourceTemplateInfo {
  name: string;
  uriTemplate: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: Record<string, any>;
  parameterSchema?: Record<string, any>;
}

/**
 * Completion request interface
 */
export interface CompletionRequest {
  ref: {
    type: 'ref/prompt' | 'ref/resource';
    name: string;
  };
  argument: {
    name: string;
    value: string;
  };
}

/**
 * Completion result interface
 */
export interface CompletionResult {
  completion: {
    values: string[];
    total?: number;
    hasMore?: boolean;
  };
}

/**
 * Completion handler function type
 */
export type CompletionHandler = (
  request: CompletionRequest
) => Promise<CompletionResult>;

/**
 * Completion configuration
 */
export interface CompletionConfig {
  name: string;
  description?: string;
  supportedTypes: Array<'ref/prompt' | 'ref/resource'>;
  supportedArguments?: string[];
}

/**
 * Sampling message interface
 */
export interface SamplingMessage {
  role: 'user' | 'assistant' | 'system';
  content: {
    type: 'text' | 'image';
    text?: string;
    data?: string; // Base64 encoded data for images
    mimeType?: string;
  };
  name?: string;
  annotations?: Record<string, any>;
}

/**
 * Model preferences for sampling
 */
export interface ModelPreferences {
  hints?: string[];
  costPriority?: number; // 0-1, where 0 is lowest cost, 1 is highest quality
  speedPriority?: number; // 0-1, where 0 is slowest, 1 is fastest
  intelligencePriority?: number; // 0-1, where 0 is simplest, 1 is most intelligent
}

/**
 * Sampling request interface
 */
export interface SamplingRequest {
  messages: SamplingMessage[];
  modelPreferences?: ModelPreferences;
  systemPrompt?: string;
  includeContext?: boolean;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, any>;
}

/**
 * Sampling response interface
 */
export interface SamplingResponse {
  model?: string;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
  role: 'assistant';
  content: {
    type: 'text';
    text: string;
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Sampling handler function type
 */
export type SamplingHandler = (
  request: SamplingRequest
) => Promise<SamplingResponse>;

/**
 * Sampling configuration
 */
export interface SamplingConfig {
  createMessage: SamplingHandler;
  includeContext?: boolean;
  supportedModels?: string[];
  maxTokensLimit?: number;
  temperatureRange?: { min: number; max: number };
  metadata?: Record<string, any>;
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
  private resourceTemplates: Map<string, ResourceTemplateInfo> = new Map();
  private prompts: Map<string, PromptInfo> = new Map();
  private completionHandlers: Map<string, { config: CompletionConfig; handler: CompletionHandler }> = new Map();
  private samplingConfig: SamplingConfig | null = null;

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
   * Register a resource template with the server
   */
  registerResourceTemplate(
    name: string,
    uriTemplate: string,
    config: ResourceTemplateConfig,
    handler: ResourceTemplateHandler
  ): void {
    // Validate template name
    if (!name || typeof name !== 'string') {
      throw MCPErrorFactory.invalidParams('Resource template name must be a non-empty string');
    }

    // Validate URI template
    if (!uriTemplate || typeof uriTemplate !== 'string') {
      throw MCPErrorFactory.invalidParams('URI template must be a non-empty string');
    }

    // Check if template already exists
    if (this.resourceTemplates.has(name)) {
      throw MCPErrorFactory.invalidParams(`Resource template '${name}' is already registered`);
    }

    // Validate URI template format
    if (!this.isValidUriTemplate(uriTemplate)) {
      throw MCPErrorFactory.invalidParams(`Invalid URI template format: ${uriTemplate}`);
    }

    // Track resource template info
    this.resourceTemplates.set(name, {
      name,
      uriTemplate,
      title: config.title,
      description: config.description,
      mimeType: config.mimeType,
      annotations: config.annotations,
      parameterSchema: config.parameterSchema
    });

    // Create template object for SDK
    const templateConfig = {
      uriTemplate,
      name,
      title: config.title,
      description: config.description,
      mimeType: config.mimeType,
      annotations: config.annotations
    };

    // Wrap handler with error handling and parameter validation
    const wrappedHandler = async (uri: URL) => {
      try {
        // Extract template parameters from URI
        const templateParams = this.extractTemplateParams(uriTemplate, uri.toString());
        
        // Validate parameters against schema if provided
        if (config.parameterSchema) {
          this.validateTemplateParams(templateParams, config.parameterSchema);
        }

        return await handler(uri, templateParams);
      } catch (error) {
        // Convert any error to MCP error format
        const mcpError = MCPErrorFactory.fromError(error);
        throw mcpError;
      }
    };

    this.sdkServer.registerResource(name, templateConfig, config as any, wrappedHandler as any);

    // Notify that resource list has changed
    if (this.started) {
      this.sendResourceListChangedNotification().catch(err => {
        console.error('Failed to send resource list changed notification:', err);
      });
    }
  }

  /**
   * List all registered resource templates
   */
  listResourceTemplates(): ResourceTemplateInfo[] {
    return Array.from(this.resourceTemplates.values());
  }

  /**
   * Get information about a specific resource template
   */
  getResourceTemplate(name: string): ResourceTemplateInfo | undefined {
    if (!name || typeof name !== 'string') {
      throw MCPErrorFactory.invalidParams('Resource template name must be a non-empty string');
    }
    return this.resourceTemplates.get(name);
  }

  /**
   * Generate a resource URI from a template
   */
  generateResourceUri(templateName: string, params: Record<string, string>): string {
    const template = this.getResourceTemplate(templateName);
    if (!template) {
      throw MCPErrorFactory.resourceNotFound(`Resource template '${templateName}' not found`);
    }

    return this.populateUriTemplate(template.uriTemplate, params);
  }

  /**
   * Validate if a URI template format is valid
   */
  private isValidUriTemplate(uriTemplate: string): boolean {
    // Basic URI template validation - checks for balanced braces
    const bracePattern = /\{([^}]+)\}/g;
    const matches = uriTemplate.match(bracePattern);
    
    if (!matches) {
      return true; // No template variables is valid
    }

    // Check that all variables are properly formatted
    return matches.every(match => {
      const varName = match.slice(1, -1); // Remove braces
      return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName); // Valid identifier
    });
  }

  /**
   * Extract template parameters from a URI using a template
   */
  private extractTemplateParams(uriTemplate: string, uri: string): Record<string, string> {
    // Convert URI template to regex pattern
    const regexPattern = uriTemplate.replace(/\{([^}]+)\}/g, '([^/]+)');
    const regex = new RegExp(`^${regexPattern}$`);
    
    const match = uri.match(regex);
    if (!match) {
      throw MCPErrorFactory.invalidParams(`URI '${uri}' does not match template '${uriTemplate}'`);
    }

    // Extract variable names from template
    const varNames = [];
    const varPattern = /\{([^}]+)\}/g;
    let varMatch;
    while ((varMatch = varPattern.exec(uriTemplate)) !== null) {
      varNames.push(varMatch[1]);
    }

    // Map captured groups to variable names
    const params: Record<string, string> = {};
    for (let i = 0; i < varNames.length; i++) {
      params[varNames[i]] = match[i + 1];
    }

    return params;
  }

  /**
   * Populate a URI template with parameters
   */
  private populateUriTemplate(uriTemplate: string, params: Record<string, string>): string {
    return uriTemplate.replace(/\{([^}]+)\}/g, (match, varName) => {
      const value = params[varName];
      if (value === undefined) {
        throw MCPErrorFactory.invalidParams(`Missing parameter '${varName}' for URI template`);
      }
      return encodeURIComponent(value);
    });
  }

  /**
   * Validate template parameters against JSON schema
   */
  private validateTemplateParams(params: Record<string, string>, schema: Record<string, any>): void {
    // Basic validation - in a real implementation, you'd use a JSON schema validator
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredParam of schema.required) {
        if (!(requiredParam in params)) {
          throw MCPErrorFactory.invalidParams(`Missing required parameter: ${requiredParam}`);
        }
      }
    }

    // Validate parameter types if specified
    if (schema.properties) {
      for (const [paramName, paramValue] of Object.entries(params)) {
        const paramSchema = schema.properties[paramName];
        if (paramSchema && paramSchema.type === 'number') {
          if (isNaN(Number(paramValue))) {
            throw MCPErrorFactory.invalidParams(`Parameter '${paramName}' must be a number`);
          }
        }
      }
    }
  }

  /**
   * Register a completion handler with the server
   */
  registerCompletion(
    config: CompletionConfig,
    handler: CompletionHandler
  ): void {
    // Validate completion name
    if (!config.name || typeof config.name !== 'string') {
      throw MCPErrorFactory.invalidParams('Completion name must be a non-empty string');
    }

    // Check if completion already exists
    if (this.completionHandlers.has(config.name)) {
      throw MCPErrorFactory.invalidParams(`Completion '${config.name}' is already registered`);
    }

    // Validate supported types
    if (!config.supportedTypes || !Array.isArray(config.supportedTypes) || config.supportedTypes.length === 0) {
      throw MCPErrorFactory.invalidParams('Completion must support at least one reference type');
    }

    const validTypes = ['ref/prompt', 'ref/resource'];
    for (const type of config.supportedTypes) {
      if (!validTypes.includes(type)) {
        throw MCPErrorFactory.invalidParams(`Invalid completion type: ${type}`);
      }
    }

    // Store completion handler
    this.completionHandlers.set(config.name, { config, handler });

    // Register with SDK server using completion/complete method
    const CompletionRequestSchema = z.object({
      method: z.literal('completion/complete'),
      params: z.object({
        ref: z.object({
          type: z.union([z.literal('ref/prompt'), z.literal('ref/resource')]),
          name: z.string()
        }),
        argument: z.object({
          name: z.string(),
          value: z.string()
        })
      })
    });

    // Only register the handler once (on first completion registration)
    if (this.completionHandlers.size === 0) {
      this.sdkServer.setRequestHandler(CompletionRequestSchema, async (request, extra) => {
        try {
          const completionRequest = request.params as CompletionRequest;
          return await this.handleCompletion(completionRequest);
        } catch (error) {
          const mcpError = MCPErrorFactory.fromError(error);
          throw mcpError;
        }
      });
    }
  }

  /**
   * Handle completion requests
   */
  private async handleCompletion(request: CompletionRequest): Promise<CompletionResult> {
    // Find appropriate completion handler
    for (const [name, { config, handler }] of this.completionHandlers) {
      // Check if this handler supports the reference type
      if (!config.supportedTypes.includes(request.ref.type)) {
        continue;
      }

      // Check if this handler supports the specific argument (if specified)
      if (config.supportedArguments && !config.supportedArguments.includes(request.argument.name)) {
        continue;
      }

      // Check if the referenced item exists
      if (!this.referenceExists(request.ref)) {
        continue;
      }

      try {
        return await handler(request);
      } catch (error) {
        // If this handler fails, try the next one
        console.error(`Completion handler '${name}' failed:`, error);
        continue;
      }
    }

    // No suitable handler found or reference doesn't exist
    if (!this.referenceExists(request.ref)) {
      throw MCPErrorFactory.invalidParams(
        `Reference ${request.ref.type} '${request.ref.name}' not found`
      );
    }

    // Return empty completion if no handler matches
    return {
      completion: {
        values: [],
        total: 0,
        hasMore: false
      }
    };
  }

  /**
   * Check if a reference exists
   */
  private referenceExists(ref: { type: string; name: string }): boolean {
    switch (ref.type) {
      case 'ref/prompt':
        return this.prompts.has(ref.name);
      case 'ref/resource':
        return this.resources.has(ref.name) || this.resourceTemplates.has(ref.name);
      default:
        return false;
    }
  }

  /**
   * List all registered completion handlers
   */
  listCompletions(): CompletionConfig[] {
    return Array.from(this.completionHandlers.values()).map(({ config }) => config);
  }

  /**
   * Get a specific completion handler configuration
   */
  getCompletion(name: string): CompletionConfig | undefined {
    if (!name || typeof name !== 'string') {
      throw MCPErrorFactory.invalidParams('Completion name must be a non-empty string');
    }
    return this.completionHandlers.get(name)?.config;
  }

  /**
   * Get completions for a specific reference and argument
   */
  async getCompletions(
    ref: { type: 'ref/prompt' | 'ref/resource'; name: string },
    argument: { name: string; value: string }
  ): Promise<CompletionResult> {
    const request: CompletionRequest = { ref, argument };
    return this.handleCompletion(request);
  }

  /**
   * Create a default completion handler for prompts
   */
  registerDefaultPromptCompletion(): void {
    this.registerCompletion(
      {
        name: 'default-prompt-completion',
        description: 'Default completion for prompt arguments',
        supportedTypes: ['ref/prompt']
      },
      async (request) => {
        const prompt = this.getPrompt(request.ref.name);
        if (!prompt) {
          throw MCPErrorFactory.invalidParams(`Prompt '${request.ref.name}' not found`);
        }

        // Extract possible values from prompt arguments schema
        const values: string[] = [];
        
        // If the prompt has argument schema, try to extract enum values
        if (prompt.arguments && Array.isArray(prompt.arguments)) {
          // This is a simplified implementation - in practice, you'd parse the actual schema
          for (const arg of prompt.arguments) {
            if (typeof arg === 'string' && arg.includes(request.argument.name)) {
              // Add some common completion suggestions
              values.push(...this.getCommonCompletions(request.argument.name, request.argument.value));
            }
          }
        }

        return {
          completion: {
            values: values.slice(0, 10), // Limit to 10 suggestions
            total: values.length,
            hasMore: values.length > 10
          }
        };
      }
    );
  }

  /**
   * Create a default completion handler for resources
   */
  registerDefaultResourceCompletion(): void {
    this.registerCompletion(
      {
        name: 'default-resource-completion',
        description: 'Default completion for resource references',
        supportedTypes: ['ref/resource']
      },
      async (request) => {
        const resource = this.getResource(request.ref.name);
        const template = this.getResourceTemplate(request.ref.name);
        
        if (!resource && !template) {
          throw MCPErrorFactory.invalidParams(`Resource '${request.ref.name}' not found`);
        }

        const values: string[] = [];

        // For templates, suggest parameter completions
        if (template && request.argument.name === 'uri') {
          const templateVars = this.extractTemplateVariables(template.uriTemplate);
          values.push(...templateVars.map(v => `{${v}}`));
        }

        // Add common completions based on argument name and value
        values.push(...this.getCommonCompletions(request.argument.name, request.argument.value));

        return {
          completion: {
            values: values.slice(0, 10),
            total: values.length,
            hasMore: values.length > 10
          }
        };
      }
    );
  }

  /**
   * Get common completion suggestions based on argument name and partial value
   */
  private getCommonCompletions(argumentName: string, partialValue: string): string[] {
    const suggestions: string[] = [];
    const lowerArgName = argumentName.toLowerCase();
    const lowerValue = partialValue.toLowerCase();

    // Common completions based on argument name patterns
    if (lowerArgName.includes('file') || lowerArgName.includes('path')) {
      suggestions.push('.txt', '.json', '.md', '.csv', '.xml');
    } else if (lowerArgName.includes('format') || lowerArgName.includes('type')) {
      suggestions.push('json', 'xml', 'csv', 'txt', 'markdown');
    } else if (lowerArgName.includes('lang') || lowerArgName.includes('language')) {
      suggestions.push('en', 'es', 'fr', 'de', 'ja', 'zh');
    } else if (lowerArgName.includes('mode') || lowerArgName.includes('method')) {
      suggestions.push('create', 'read', 'update', 'delete', 'list');
    }

    // Filter suggestions that start with the partial value
    return suggestions
      .filter(s => s.toLowerCase().startsWith(lowerValue))
      .map(s => partialValue + s.substring(lowerValue.length));
  }

  /**
   * Extract template variables from URI template
   */
  private extractTemplateVariables(uriTemplate: string): string[] {
    const variables: string[] = [];
    const varPattern = /\{([^}]+)\}/g;
    let match;
    
    while ((match = varPattern.exec(uriTemplate)) !== null) {
      variables.push(match[1]);
    }
    
    return variables;
  }

  /**
   * Get a summary of all registered capabilities
   */
  getCapabilities(): {
    tools: ToolInfo[];
    resources: ResourceInfo[];
    resourceTemplates: ResourceTemplateInfo[];
    prompts: PromptInfo[];
    completions: CompletionConfig[];
    sampling?: SamplingConfig;
  } {
    return {
      tools: this.getTools(),
      resources: this.getResources(),
      resourceTemplates: this.listResourceTemplates(),
      prompts: this.getPrompts(),
      completions: this.listCompletions(),
      ...(this.samplingConfig && { sampling: this.samplingConfig })
    };
  }

  /**
   * Register sampling functionality with the server
   */
  registerSampling(config: SamplingConfig): void {
    // Validate sampling configuration
    if (!config.createMessage || typeof config.createMessage !== 'function') {
      throw MCPErrorFactory.invalidParams('Sampling createMessage handler must be a function');
    }

    // Validate temperature range if provided
    if (config.temperatureRange) {
      const { min, max } = config.temperatureRange;
      if (typeof min !== 'number' || typeof max !== 'number' || min < 0 || max > 2 || min > max) {
        throw MCPErrorFactory.invalidParams('Invalid temperature range: must be between 0-2 and min <= max');
      }
    }

    // Validate max tokens limit if provided
    if (config.maxTokensLimit && (typeof config.maxTokensLimit !== 'number' || config.maxTokensLimit <= 0)) {
      throw MCPErrorFactory.invalidParams('Max tokens limit must be a positive number');
    }

    this.samplingConfig = config;

    // Register with SDK server using sampling/createMessage method
    const SamplingRequestSchema = z.object({
      method: z.literal('sampling/createMessage'),
      params: z.object({
        messages: z.array(z.object({
          role: z.enum(['user', 'assistant', 'system']),
          content: z.object({
            type: z.enum(['text', 'image']),
            text: z.string().optional(),
            data: z.string().optional(),
            mimeType: z.string().optional()
          }),
          name: z.string().optional(),
          annotations: z.record(z.any()).optional()
        })),
        modelPreferences: z.object({
          hints: z.array(z.string()).optional(),
          costPriority: z.number().min(0).max(1).optional(),
          speedPriority: z.number().min(0).max(1).optional(),
          intelligencePriority: z.number().min(0).max(1).optional()
        }).optional(),
        systemPrompt: z.string().optional(),
        includeContext: z.boolean().optional(),
        maxTokens: z.number().positive().optional(),
        temperature: z.number().min(0).max(2).optional(),
        metadata: z.record(z.any()).optional()
      })
    });

    this.sdkServer.setRequestHandler(SamplingRequestSchema, async (request, extra) => {
      try {
        const samplingRequest = request.params as SamplingRequest;
        return await this.handleSampling(samplingRequest);
      } catch (error) {
        const mcpError = MCPErrorFactory.fromError(error);
        throw mcpError;
      }
    });
  }

  /**
   * Handle sampling requests
   */
  private async handleSampling(request: SamplingRequest): Promise<SamplingResponse> {
    if (!this.samplingConfig) {
      throw MCPErrorFactory.invalidRequest('Sampling is not configured on this server');
    }

    // Validate request parameters
    this.validateSamplingRequest(request);

    // Apply server-side limits and defaults
    const processedRequest = this.processSamplingRequest(request);

    try {
      const response = await this.samplingConfig.createMessage(processedRequest);
      
      // Validate response format
      this.validateSamplingResponse(response);
      
      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw MCPErrorFactory.internalError(`Sampling failed: ${error.message}`);
      }
      throw MCPErrorFactory.internalError('Sampling failed with unknown error');
    }
  }

  /**
   * Validate sampling request parameters
   */
  private validateSamplingRequest(request: SamplingRequest): void {
    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      throw MCPErrorFactory.invalidParams('Sampling request must include at least one message');
    }

    // Validate each message
    for (const [index, message] of request.messages.entries()) {
      if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
        throw MCPErrorFactory.invalidParams(`Invalid role at message ${index}: must be user, assistant, or system`);
      }

      if (!message.content || typeof message.content !== 'object') {
        throw MCPErrorFactory.invalidParams(`Invalid content at message ${index}: must be an object`);
      }

      if (!message.content.type || !['text', 'image'].includes(message.content.type)) {
        throw MCPErrorFactory.invalidParams(`Invalid content type at message ${index}: must be text or image`);
      }

      if (message.content.type === 'text' && !message.content.text) {
        throw MCPErrorFactory.invalidParams(`Text message at index ${index} must have text content`);
      }

      if (message.content.type === 'image' && (!message.content.data || !message.content.mimeType)) {
        throw MCPErrorFactory.invalidParams(`Image message at index ${index} must have data and mimeType`);
      }
    }

    // Validate model preferences if provided
    if (request.modelPreferences) {
      const prefs = request.modelPreferences;
      if (prefs.costPriority !== undefined && (prefs.costPriority < 0 || prefs.costPriority > 1)) {
        throw MCPErrorFactory.invalidParams('Cost priority must be between 0 and 1');
      }
      if (prefs.speedPriority !== undefined && (prefs.speedPriority < 0 || prefs.speedPriority > 1)) {
        throw MCPErrorFactory.invalidParams('Speed priority must be between 0 and 1');
      }
      if (prefs.intelligencePriority !== undefined && (prefs.intelligencePriority < 0 || prefs.intelligencePriority > 1)) {
        throw MCPErrorFactory.invalidParams('Intelligence priority must be between 0 and 1');
      }
    }

    // Validate temperature if provided
    if (request.temperature !== undefined) {
      if (typeof request.temperature !== 'number' || request.temperature < 0 || request.temperature > 2) {
        throw MCPErrorFactory.invalidParams('Temperature must be a number between 0 and 2');
      }

      // Check against server limits
      if (this.samplingConfig?.temperatureRange) {
        const { min, max } = this.samplingConfig.temperatureRange;
        if (request.temperature < min || request.temperature > max) {
          throw MCPErrorFactory.invalidParams(`Temperature must be between ${min} and ${max}`);
        }
      }
    }

    // Validate max tokens if provided
    if (request.maxTokens !== undefined) {
      if (typeof request.maxTokens !== 'number' || request.maxTokens <= 0) {
        throw MCPErrorFactory.invalidParams('Max tokens must be a positive number');
      }

      // Check against server limits
      if (this.samplingConfig?.maxTokensLimit && request.maxTokens > this.samplingConfig.maxTokensLimit) {
        throw MCPErrorFactory.invalidParams(`Max tokens cannot exceed ${this.samplingConfig.maxTokensLimit}`);
      }
    }
  }

  /**
   * Process sampling request with server defaults and context
   */
  private processSamplingRequest(request: SamplingRequest): SamplingRequest {
    const processed = { ...request };

    // Add context if enabled and available
    if (this.samplingConfig?.includeContext !== false && request.includeContext !== false) {
      // Add server context to the request
      if (!processed.metadata) {
        processed.metadata = {};
      }
      processed.metadata.serverContext = {
        name: this.config.name,
        version: this.config.version,
        capabilities: {
          tools: this.tools.size,
          resources: this.resources.size,
          prompts: this.prompts.size
        },
        timestamp: new Date().toISOString()
      };
    }

    // Apply server defaults
    if (this.samplingConfig?.maxTokensLimit && !processed.maxTokens) {
      processed.maxTokens = Math.min(this.samplingConfig.maxTokensLimit, 4096); // Default max tokens
    }

    if (this.samplingConfig?.temperatureRange && !processed.temperature) {
      // Use middle of the allowed range as default
      const { min, max } = this.samplingConfig.temperatureRange;
      processed.temperature = (min + max) / 2;
    }

    return processed;
  }

  /**
   * Validate sampling response format
   */
  private validateSamplingResponse(response: SamplingResponse): void {
    if (!response || typeof response !== 'object') {
      throw MCPErrorFactory.internalError('Sampling response must be an object');
    }

    if (response.role !== 'assistant') {
      throw MCPErrorFactory.internalError('Sampling response role must be assistant');
    }

    if (!response.content || typeof response.content !== 'object') {
      throw MCPErrorFactory.internalError('Sampling response must have content object');
    }

    if (response.content.type !== 'text' || typeof response.content.text !== 'string') {
      throw MCPErrorFactory.internalError('Sampling response content must be text type with string text');
    }

    if (response.stopReason && !['endTurn', 'stopSequence', 'maxTokens'].includes(response.stopReason)) {
      throw MCPErrorFactory.internalError('Invalid stop reason in sampling response');
    }

    if (response.usage) {
      const { inputTokens, outputTokens, totalTokens } = response.usage;
      if (inputTokens !== undefined && (typeof inputTokens !== 'number' || inputTokens < 0)) {
        throw MCPErrorFactory.internalError('Invalid input tokens count in usage');
      }
      if (outputTokens !== undefined && (typeof outputTokens !== 'number' || outputTokens < 0)) {
        throw MCPErrorFactory.internalError('Invalid output tokens count in usage');
      }
      if (totalTokens !== undefined && (typeof totalTokens !== 'number' || totalTokens < 0)) {
        throw MCPErrorFactory.internalError('Invalid total tokens count in usage');
      }
    }
  }

  /**
   * Check if sampling is available
   */
  isSamplingAvailable(): boolean {
    return this.samplingConfig !== null;
  }

  /**
   * Get sampling configuration (without sensitive handler)
   */
  getSamplingInfo(): Omit<SamplingConfig, 'createMessage'> | null {
    if (!this.samplingConfig) {
      return null;
    }

    const { createMessage, ...info } = this.samplingConfig;
    return info;
  }

  /**
   * Create a sampling request for testing or internal use
   */
  async createSamplingMessage(request: SamplingRequest): Promise<SamplingResponse> {
    if (!this.samplingConfig) {
      throw MCPErrorFactory.invalidRequest('Sampling is not configured on this server');
    }

    return this.handleSampling(request);
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

// Re-export resource template types
export type {
  ResourceTemplate,
  ResourceTemplateConfig,
  ResourceTemplateHandler,
  ResourceTemplateInfo
};

// Re-export completion types
export type {
  CompletionRequest,
  CompletionResult,
  CompletionHandler,
  CompletionConfig
};

// Re-export sampling types
export type {
  SamplingMessage,
  ModelPreferences,
  SamplingRequest,
  SamplingResponse,
  SamplingHandler,
  SamplingConfig
};
