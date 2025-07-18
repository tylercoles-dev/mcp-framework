import { MCPToolResult } from '../types';

export class MCPClient {
  private baseUrl: string;
  private initialized = false;
  private sessionId: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Send initialize request
    const initResponse = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: {
              listChanged: true
            },
            sampling: {},
            elicitation: {}
          },
          clientInfo: {
            name: 'KanbanClient',
            title: 'Kanban Board Client',
            version: '1.0.0'
          }
        }
      }),
    });

    if (!initResponse.ok) {
      throw new Error(`Initialization failed: ${initResponse.status}`);
    }

    // Store session ID if provided
    const sessionId = initResponse.headers.get('mcp-session-id');
    if (sessionId) {
      this.sessionId = sessionId;
    }

    const initData = await initResponse.json();
    if (initData.error) {
      throw new Error(`Initialization error: ${initData.error.message}`);
    }

    // Send initialized notification
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    
    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

    const notifyResponse = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      }),
    });

    if (!notifyResponse.ok) {
      throw new Error(`Initialized notification failed: ${notifyResponse.status}`);
    }

    this.initialized = true;
  }

  async callTool(toolName: string, args: Record<string, any>): Promise<MCPToolResult> {
    await this.initialize();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    
    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Tool call failed');
    }

    return data.result;
  }

  async getResource(uri: string): Promise<any> {
    await this.initialize();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    
    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'resources/read',
        params: {
          uri,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Resource fetch failed');
    }

    // Parse JSON if it's a text resource
    if (data.result?.contents?.[0]?.text) {
      try {
        return JSON.parse(data.result.contents[0].text);
      } catch {
        return data.result.contents[0].text;
      }
    }

    return data.result;
  }
}