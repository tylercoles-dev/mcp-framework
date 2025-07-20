import { MCPServer, z } from '@tylercoles/mcp-server';
import { MemoryService } from '../services/memory-service.js';
import { logger } from '../utils/logger.js';

/**
 * Setup all memory-related tools on the MCP server
 */
export function setupMemoryTools(server: MCPServer, memoryService: MemoryService): void {
  // Store Memory Tool
  server.registerTool(
    "store_memory",
    {
      title: "Store Memory",
      description: "Store a new memory with content, project, topic, type, and tags",
      inputSchema: z.object({
        content: z.string().describe("The content/text of the memory to store"),
        projectName: z.string().optional().describe("Project name for organizing memories (default: 'default')"),
        memoryTopic: z.string().optional().describe("Topic/category within the project (default: 'general')"),
        memoryType: z.string().optional().describe("Type of memory like 'note', 'fact', 'idea', etc. (default: 'note')"),
        tags: z.array(z.string()).optional().describe("Optional tags for categorization")
      })
    },
    async (args, context) => {
      const user = context.user;
      if (!user) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Authentication required'
          }],
          isError: true
        };
      }

      const result = await memoryService.storeMemory({
        user,
        content: args.content,
        projectName: args.projectName || 'default',
        memoryTopic: args.memoryTopic || 'general',
        memoryType: args.memoryType || 'note',
        tags: args.tags || []
      });

      return {
        content: [{
          type: 'text',
          text: `Memory stored successfully.\nID: ${result.id}\nProject: ${result.projectName}\nTopic: ${result.memoryTopic}`
        }]
      };
    }
  );

  // Retrieve Memories Tool
  server.registerTool(
    "retrieve_memories",
    {
      title: "Retrieve Memories",
      description: "Search and retrieve memories using semantic search",
      inputSchema: z.object({
        query: z.string().describe("Search query to find relevant memories"),
        projectName: z.string().optional().describe("Filter by project name"),
        memoryTopic: z.string().optional().describe("Filter by memory topic"),
        memoryType: z.string().optional().describe("Filter by memory type"),
        limit: z.number().optional().describe("Maximum number of results (default: 10)"),
        tags: z.array(z.string()).optional().describe("Filter by tags")
      })
    },
    async (args, context) => {
      const user = context.user;
      if (!user) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Authentication required'
          }],
          isError: true
        };
      }

      const memories = await memoryService.retrieveMemories({
        user,
        query: args.query,
        projectName: args.projectName,
        memoryTopic: args.memoryTopic,
        memoryType: args.memoryType,
        limit: args.limit || 10,
        tags: args.tags
      });

      if (memories.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No memories found matching your query.'
          }]
        };
      }

      const formattedMemories = memories.map((m, i) => 
        `[${i + 1}] ${m.memory.content}\n` +
        `    Project: ${m.memory.projectName} | Topic: ${m.memory.memoryTopic} | ` +
        `    Type: ${m.memory.memoryType} | Score: ${m.similarity.toFixed(2)}`
      ).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `Found ${memories.length} memories:\n\n${formattedMemories}`
        }]
      };
    }
  );

  // Search by Tag Tool
  server.registerTool(
    "search_by_tag",
    {
      title: "Search by Tag",
      description: "Find memories by specific tags",
      inputSchema: z.object({
        tag: z.string().describe("Tag to search for"),
        projectName: z.string().optional().describe("Filter by project name"),
        memoryTopic: z.string().optional().describe("Filter by memory topic"),
        memoryType: z.string().optional().describe("Filter by memory type"),
        limit: z.number().optional().describe("Maximum number of results (default: 10)")
      })
    },
    async (args, context) => {
      const user = context.user;
      if (!user) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Authentication required'
          }],
          isError: true
        };
      }

      const results = await memoryService.getMemoriesByTag({
        user,
        tag: args.tag,
        projectName: args.projectName,
        memoryTopic: args.memoryTopic,
        memoryType: args.memoryType,
        limit: args.limit || 10
      });

      if (results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No memories found with tag: ${args.tag}`
          }]
        };
      }

      const formattedResults = results.map((m, i) => 
        `[${i + 1}] ${m.content}\n` +
        `    Project: ${m.projectName} | Topic: ${m.memoryTopic} | Type: ${m.memoryType}`
      ).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `Found ${results.length} memories with tag "${args.tag}":\n\n${formattedResults}`
        }]
      };
    }
  );

  // Recall Memories Tool
  server.registerTool(
    "recall_memories",
    {
      title: "Recall Memories",
      description: "Recall memories from a specific time period",
      inputSchema: z.object({
        timeExpression: z.string().describe("Natural time expression like 'last week', 'yesterday', '2 days ago'"),
        query: z.string().optional().describe("Optional additional search query"),
        limit: z.number().optional().describe("Maximum number of results (default: 10)")
      })
    },
    async (args, context) => {
      const user = context.user;
      if (!user) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Authentication required'
          }],
          isError: true
        };
      }

      const results = await memoryService.recallMemories({
        user,
        timeExpression: args.timeExpression,
        query: args.query || '',
        limit: args.limit || 10
      });

      if (results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No memories found for time period: ${args.timeExpression}`
          }]
        };
      }

      const formattedResults = results.map((m, i) => {
        const date = new Date(m.memory.timestamp);
        return `[${i + 1}] ${m.memory.content}\n` +
          `    Time: ${date.toLocaleString()} | ` +
          `    Project: ${m.memory.projectName} | Topic: ${m.memory.memoryTopic}`;
      }).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `Memories from ${args.timeExpression}:\n\n${formattedResults}`
        }]
      };
    }
  );

  // Delete Memory Tool
  server.registerTool(
    "delete_memory",
    {
      title: "Delete Memory",
      description: "Delete a specific memory by ID",
      inputSchema: z.object({
        memoryId: z.string().describe("ID of the memory to delete")
      })
    },
    async (args, context) => {
      const user = context.user;
      if (!user) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Authentication required'
          }],
          isError: true
        };
      }

      const deleted = await memoryService.deleteMemory({
        user,
        memoryId: args.memoryId
      });

      return {
        content: [{
          type: 'text',
          text: deleted ? 'Memory deleted successfully.' : 'Memory not found or access denied.'
        }]
      };
    }
  );

  // Get Memory Stats Tool
  server.registerTool(
    "get_memory_stats",
    {
      title: "Get Memory Statistics",
      description: "Get statistics about your stored memories",
      inputSchema: z.object({})
    },
    async (_args, context) => {
      const user = context.user;
      if (!user) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Authentication required'
          }],
          isError: true
        };
      }

      try {
        const stats = await memoryService.getMemoryStats(user);
        
        const formattedStats = `Memory Statistics for ${user.username}:\nTotal Memories: ${stats.totalMemories}\nTotal Tags: ${stats.totalTags}\nOldest Memory: ${stats.oldestMemory || 'N/A'}\nNewest Memory: ${stats.newestMemory || 'N/A'}`;

        return {
          content: [{
            type: 'text',
            text: formattedStats
          }]
        };
      } catch (error) {
        logger.error('Failed to get memory statistics', { error, userId: user.id });
        return {
          content: [{
            type: 'text',
            text: `Memory system is initializing. Stats will be available once you create your first memory.\nError: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  );

  // List Projects Tool
  server.registerTool(
    "list_projects",
    {
      title: "List Projects",
      description: "List all your memory projects",
      inputSchema: z.object({})
    },
    async (_args, context) => {
      const user = context.user;
      if (!user) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Authentication required'
          }],
          isError: true
        };
      }

      const projects = await memoryService.getUserProjects(user);
      
      if (projects.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No projects found. Create your first memory to start a project!'
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Your projects:\n${projects.map(p => `  - ${p}`).join('\n')}`
        }]
      };
    }
  );

  // List Topics Tool
  server.registerTool(
    "list_topics",
    {
      title: "List Topics",
      description: "List all topics within a specific project",
      inputSchema: z.object({
        projectName: z.string().describe("Project name to get topics for")
      })
    },
    async (args, context) => {
      const user = context.user;
      if (!user) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Authentication required'
          }],
          isError: true
        };
      }

      const topics = await memoryService.getProjectTopics({
        user,
        projectName: args.projectName
      });
      
      if (topics.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No topics found in project: ${args.projectName}`
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Topics in project "${args.projectName}":\n${topics.map(t => `  - ${t}`).join('\n')}`
        }]
      };
    }
  );

  // List Types Tool
  server.registerTool(
    "list_types",
    {
      title: "List Memory Types",
      description: "List all memory types within a specific project and topic",
      inputSchema: z.object({
        projectName: z.string().describe("Project name"),
        memoryTopic: z.string().describe("Memory topic within the project")
      })
    },
    async (args, context) => {
      const user = context.user;
      if (!user) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Authentication required'
          }],
          isError: true
        };
      }

      const types = await memoryService.getTopicTypes({
        user,
        projectName: args.projectName,
        memoryTopic: args.memoryTopic
      });
      
      if (types.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No memory types found in ${args.projectName}/${args.memoryTopic}`
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Memory types in "${args.projectName}/${args.memoryTopic}":\n${types.map(t => `  - ${t}`).join('\n')}`
        }]
      };
    }
  );

  // List Available Tools - Meta tool for introspection
  server.registerTool(
    "list_available_tools",
    {
      title: "List Available Tools",
      description: "Get a list of all available memory management tools",
      inputSchema: z.object({})
    },
    async (_args, _context) => {
      const tools = server.getTools();
      
      const toolList = tools
        .filter(t => t.name !== 'list_available_tools') // Don't include this meta tool
        .map(tool => {
          const header = `**${tool.title || tool.name}**`;
          const desc = `  ${tool.description}`;
          const usage = `  Usage: ${tool.name}`;
          return [header, desc, usage].join('');
        })
        .join('');

      return {
        content: [{
          type: 'text',
          text: `Available Memory Tools (${tools.length - 1}):

${toolList}

Use any of these tools to manage your memories effectively!`
        }]
      };
    }
  );

  const registeredTools = server.getTools().length;
  logger.info('Memory tools registered', { toolCount: registeredTools });
}
