import { MCPToolResult } from '../types';

export class MCPClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async callTool(toolName: string, args: Record<string, any>): Promise<MCPToolResult> {
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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