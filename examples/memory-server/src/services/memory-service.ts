import type {
  Memory,
  MemorySearchQuery,
  MemorySearchResult,
  AuthUser
} from '../types/index.js';
import { NATSService } from './nats-service.js';
import { logger } from '../utils/logger.js';

/**
 * Memory service providing business logic for memory operations
 */
export class MemoryService {
  private readonly natsService: NATSService;

  constructor(natsService: NATSService) {
    this.natsService = natsService;
  }

  /**
   * Store a new memory for a user
   */
  /**
   * Store a new memory for a user
   */
  async storeMemory(
    {
      user,
      content,
      projectName = 'default',
      memoryTopic = 'general',
      memoryType = 'note',
      tags = []
    }: {
      user: AuthUser,
      content: string,
      projectName?: string,
      memoryTopic?: string,
      memoryType?: string,
      tags?: string[]
    }
  ): Promise<Memory> {
    // Validate input
    if (!content || content.trim().length === 0) {
      throw new Error('Memory content cannot be empty');
    }

    if (content.length > 50000) {
      throw new Error('Memory content too long (max 50,000 characters)');
    }

    // Validate hierarchical components
    if (!projectName || projectName.trim().length === 0) {
      projectName = 'default';
    }
    if (!memoryTopic || memoryTopic.trim().length === 0) {
      memoryTopic = 'general';
    }
    if (!memoryType || memoryType.trim().length === 0) {
      memoryType = 'note';
    }

    // Sanitize hierarchical components
    const sanitizeComponent = (str: string): string =>
      str.trim().toLowerCase().replace(/[^a-z0-9_-\s]/g, '').replace(/\s+/g, '_');

    const sanitizedProject = sanitizeComponent(projectName);
    const sanitizedTopic = sanitizeComponent(memoryTopic);
    const sanitizedType = sanitizeComponent(memoryType);

    // Sanitize tags
    const sanitizedTags = tags
      .filter(tag => tag && tag.trim().length > 0)
      .map(tag => tag.trim().toLowerCase())
      .filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates

    if (sanitizedTags.length > 20) {
      throw new Error('Too many tags (max 20)');
    }

    try {
      const memory = await this.natsService.storeMemory(
        user.id,
        sanitizedProject,
        sanitizedTopic,
        sanitizedType,
        content.trim(),
        sanitizedTags
      );

      logger.info('Memory stored for user', {
        userId: user.id,
        memoryId: memory.id,
        projectName: sanitizedProject,
        memoryTopic: sanitizedTopic,
        memoryType: sanitizedType,
        contentLength: content.length,
        contentType: memory.contentType,
        tagCount: sanitizedTags.length
      });

      return memory;
    } catch (error) {
      logger.error('Failed to store memory', {
        userId: user.id,
        error,
        projectName: sanitizedProject,
        memoryTopic: sanitizedTopic,
        memoryType: sanitizedType,
        contentLength: content.length
      });
      throw new Error('Failed to store memory');
    }
  }

  /**
   * Retrieve memories for a user with search
   */
  /**
   * Retrieve memories for a user with search and filtering
   */
  async retrieveMemories(
    {
      user, query = '', projectName, memoryTopic, memoryType, limit = 10, tags = [] }:
      {
        user: AuthUser,
        query: string,
        projectName?: string,
        memoryTopic?: string,
        memoryType?: string,
        limit: number,
        tags?: string[]
      }
  ): Promise<MemorySearchResult[]> {
    // Validate input
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    const searchQuery: MemorySearchQuery = {
      userId: user.id,
      query: query.trim(),
      projectName: projectName?.trim(),
      memoryTopic: memoryTopic?.trim(),
      memoryType: memoryType?.trim(),
      tags: tags.map(tag => tag.trim().toLowerCase()),
      limit,
      similarityThreshold: 0.1
    };

    try {
      const results = await this.natsService.retrieveMemories(searchQuery);

      logger.info('Retrieved memories for user', {
        userId: user.id,
        query,
        projectName,
        memoryTopic,
        memoryType,
        resultCount: results.length,
        tags
      });

      return results;
    } catch (error) {
      logger.error('Failed to retrieve memories', {
        userId: user.id,
        query,
        projectName,
        memoryTopic,
        memoryType,
        error
      });
      throw new Error('Failed to retrieve memories');
    }
  }

  /**
   * Get memories by specific tag
   */
  /**
   * Get memories by specific tag
   */
  async getMemoriesByTag(
    {
      user,
      tag,
      projectName,
      memoryTopic,
      memoryType,
      limit = 10
    }: {
      user: AuthUser,
      tag: string,
      projectName?: string,
      memoryTopic?: string,
      memoryType?: string,
      limit?: number
    }
  ): Promise<Memory[]> {
    if (!tag || tag.trim().length === 0) {
      throw new Error('Tag cannot be empty');
    }

    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    try {
      const memories = await this.natsService.getMemoriesByTag(
        user.id,
        tag.trim().toLowerCase(),
        projectName?.trim(),
        memoryTopic?.trim(),
        memoryType?.trim(),
        limit
      );

      logger.info('Retrieved memories by tag', {
        userId: user.id,
        tag,
        projectName,
        memoryTopic,
        memoryType,
        resultCount: memories.length
      });

      return memories;
    } catch (error) {
      logger.error('Failed to get memories by tag', {
        userId: user.id,
        tag,
        projectName,
        memoryTopic,
        memoryType,
        error
      });
      throw new Error('Failed to get memories by tag');
    }
  }

  /**
   * Delete a specific memory
   */
  async deleteMemory(
    {
      user,
      memoryId
    }: {
      user: AuthUser,
      memoryId: string
    }
  ): Promise<boolean> {
    if (!memoryId || memoryId.trim().length === 0) {
      throw new Error('Memory ID cannot be empty');
    }

    try {
      // First verify the memory belongs to the user
      const memories = await this.retrieveMemories({
        user,
        query: '',
        limit: 1000,
        tags: []
      });
      const memoryExists = memories.some(result =>
        result.memory.id === memoryId && result.memory.userId === user.id
      );

      if (!memoryExists) {
        logger.warn('Attempted to delete non-existent or unauthorized memory', {
          userId: user.id,
          memoryId
        });
        return false;
      }

      const deleted = await this.natsService.deleteMemory({ userId: user.id, memoryId });

      if (deleted) {
        logger.info('Memory deleted', {
          userId: user.id,
          memoryId
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete memory', {
        userId: user.id,
        memoryId,
        error
      });
      throw new Error('Failed to delete memory');
    }
  }

  /**
   * Get memory statistics for a user
   */
  async getMemoryStats(user: AuthUser): Promise<{
    totalMemories: number;
    totalTags: number;
    oldestMemory: string | null;
    newestMemory: string | null;
  }> {
    try {
      const stats = await this.natsService.getMemoryStats(user.id);

      const result = {
        totalMemories: stats.totalMemories,
        totalTags: stats.totalTags,
        oldestMemory: stats.oldestMemory > 0
          ? new Date(stats.oldestMemory).toISOString()
          : null,
        newestMemory: stats.newestMemory > 0
          ? new Date(stats.newestMemory).toISOString()
          : null
      };

      logger.info('Retrieved memory stats', {
        userId: user.id,
        ...result
      });

      return result;
    } catch (error) {
      logger.error('Failed to get memory stats', {
        userId: user.id,
        error
      });
      throw new Error('Failed to get memory statistics');
    }
  }

  /**
   * Get all projects for a user
   */
  async getUserProjects(user: AuthUser): Promise<string[]> {
    try {
      const projects = await this.natsService.getUserProjects(user.id);

      logger.info('Retrieved user projects', {
        userId: user.id,
        projectCount: projects.length
      });

      return projects;
    } catch (error) {
      logger.error('Failed to get user projects', {
        userId: user.id,
        error
      });
      throw new Error('Failed to get user projects');
    }
  }

  /**
   * Get all topics for a project
   */
  async getProjectTopics(
    {
      user,
      projectName
    }: {
      user: AuthUser,
      projectName: string
    }
  ): Promise<string[]> {
    if (!projectName || projectName.trim().length === 0) {
      throw new Error('Project name cannot be empty');
    }

    try {
      const topics = await this.natsService.getProjectTopics(user.id, projectName.trim());

      logger.info('Retrieved project topics', {
        userId: user.id,
        projectName,
        topicCount: topics.length
      });

      return topics;
    } catch (error) {
      logger.error('Failed to get project topics', {
        userId: user.id,
        projectName,
        error
      });
      throw new Error('Failed to get project topics');
    }
  }

  /**
   * Get all types for a topic
   */
  async getTopicTypes(
    {
      user,
      projectName,
      memoryTopic
    }: {
      user: AuthUser,
      projectName: string,
      memoryTopic: string
    }
  ): Promise<string[]> {
    if (!projectName || projectName.trim().length === 0) {
      throw new Error('Project name cannot be empty');
    }
    if (!memoryTopic || memoryTopic.trim().length === 0) {
      throw new Error('Memory topic cannot be empty');
    }

    try {
      const types = await this.natsService.getTopicTypes(user.id, projectName.trim(), memoryTopic.trim());

      logger.info('Retrieved topic types', {
        userId: user.id,
        projectName,
        memoryTopic,
        typeCount: types.length
      });

      return types;
    } catch (error) {
      logger.error('Failed to get topic types', {
        userId: user.id,
        projectName,
        memoryTopic,
        error
      });
      throw new Error('Failed to get topic types');
    }
  }

  /**
   * Search memories with natural language time expressions
   */
  async recallMemories(
    {
      user,
      timeExpression,
      query = '',
      limit = 10
    }: {
      user: AuthUser,
      timeExpression: string,
      query?: string,
      limit?: number
    }
  ): Promise<MemorySearchResult[]> {
    // Parse time expression to timestamp range
    const timeRange = this.parseTimeExpression(timeExpression);

    try {
      // Get all memories first, then filter by time
      const allResults = await this.retrieveMemories({
        user,
        query,
        limit: 1000,
        tags: []
      });

      const filteredResults = allResults.filter(result => {
        const memoryTime = result.memory.timestamp;
        return memoryTime >= timeRange.start && memoryTime <= timeRange.end;
      });

      const limitedResults = filteredResults.slice(0, limit);

      logger.info('Recalled memories with time filter', {
        userId: user.id,
        timeExpression,
        query,
        totalFound: filteredResults.length,
        returned: limitedResults.length
      });

      return limitedResults;
    } catch (error) {
      logger.error('Failed to recall memories', {
        userId: user.id,
        timeExpression,
        query,
        error
      });
      throw new Error('Failed to recall memories');
    }
  }

  /**
   * Parse natural language time expressions
   */
  private parseTimeExpression(expression: string): { start: number; end: number } {
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStart = today.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    expression = expression.toLowerCase().trim();

    switch (expression) {
      case 'today':
        return { start: todayStart, end: todayEnd };

      case 'yesterday':
        const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
        const yesterdayEnd = todayStart;
        return { start: yesterdayStart, end: yesterdayEnd };

      case 'this week':
      case 'last 7 days':
        const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
        return { start: weekStart, end: now };

      case 'this month':
      case 'last 30 days':
        const monthStart = todayStart - 30 * 24 * 60 * 60 * 1000;
        return { start: monthStart, end: now };

      case 'last week':
        const lastWeekEnd = todayStart - (today.getDay() * 24 * 60 * 60 * 1000);
        const lastWeekStart = lastWeekEnd - 7 * 24 * 60 * 60 * 1000;
        return { start: lastWeekStart, end: lastWeekEnd };

      default:
        // Try to parse "X days ago", "X hours ago", etc.
        const daysMatch = expression.match(/(\d+)\s+days?\s+ago/);
        if (daysMatch) {
          const days = parseInt(daysMatch[1], 10);
          const start = todayStart - days * 24 * 60 * 60 * 1000;
          return { start, end: todayStart };
        }

        const hoursMatch = expression.match(/(\d+)\s+hours?\s+ago/);
        if (hoursMatch) {
          const hours = parseInt(hoursMatch[1], 10);
          const start = now - hours * 60 * 60 * 1000;
          return { start, end: now };
        }

        // Default to all time
        return { start: 0, end: now };
    }
  }

  /**
   * Health check for the memory service
   */
  async healthCheck(): Promise<{ status: string; nats: boolean }> {
    return {
      status: 'ok',
      nats: this.natsService.isConnected()
    };
  }
}
