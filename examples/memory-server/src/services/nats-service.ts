/**
 * NATS service for memory storage and retrieval using JetStream
 */
import {
  connect,
  NatsConnection,
  KV,
  StringCodec,
  StorageType
} from 'nats';
import { v4 as uuidv4 } from 'uuid';
import type {
  Memory,
  MemorySearchQuery,
  MemorySearchResult,
  NATSConfig
} from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * NATS service for memory storage and retrieval using KV store
 */
export class NATSService {
  private connection: NatsConnection | null = null;
  private kv: KV | null = null;
  private readonly codec = StringCodec();
  private readonly config: NATSConfig;
  private readonly kvBucketName = 'memories';

  constructor(config: NATSConfig) {
    this.config = config;
  }

  /**
   * Initialize NATS connection and KV store
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Connecting to NATS server...', { servers: this.config.servers });

      this.connection = await connect({
        servers: this.config.servers,
        user: this.config.user,
        pass: this.config.pass,
        token: this.config.token,
        reconnect: true,
        maxReconnectAttempts: 10,
        reconnectTimeWait: 2000,
      });

      await this.setupKVStore();

      logger.info('NATS connection established successfully');
    } catch (error) {
      logger.error('Failed to initialize NATS connection', { error });
      throw error;
    }
  }

  /**
   * Setup NATS KV store for memory storage
   */
  private async setupKVStore(): Promise<void> {
    if (!this.connection) {
      throw new Error('NATS connection not initialized');
    }

    try {
      const js = this.connection.jetstream();

      // Try to get existing KV bucket
      try {
        this.kv = await js.views.kv(this.kvBucketName);
        logger.info(`Connected to existing KV bucket: ${this.kvBucketName}`);
      } catch {
        // Create KV bucket if it doesn't exist
        this.kv = await js.views.kv(this.kvBucketName, {
          history: 10, // Keep last 10 versions
          ttl: 0, // No expiration
          storage: StorageType.File,
          replicas: 1,
          description: 'Memory storage for MCP server'
        });

        logger.info(`Created KV bucket: ${this.kvBucketName}`);
      }
    } catch (error) {
      logger.error('Failed to setup KV store', { error });
      throw error;
    }
  }

  /**
   * Generate hierarchical key for memory storage
   */
  private generateMemoryKey(
    userId: string,
    projectName: string,
    memoryTopic: string,
    memoryType: string,
    memoryId: string
  ): string {
    // Sanitize components for key usage (remove special characters)
    const sanitize = (str: string): string =>
      str.toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    const components = [
      'memories',
      sanitize(userId),
      sanitize(projectName),
      sanitize(memoryTopic),
      sanitize(memoryType),
      memoryId
    ];

    return components.join('.');
  }

  /**
   * Parse key back to components
   */
  // private _parseMemoryKey(key: string): {
  //   userId: string;
  //   projectName: string;
  //   memoryTopic: string;
  //   memoryType: string;
  //   memoryId: string;
  // } | null {
  //   const parts = key.split('.');
  //   if (parts.length !== 6 || parts[0] !== 'memories') {
  //     return null;
  //   }

  //   return {
  //     userId: parts[1],
  //     projectName: parts[2],
  //     memoryTopic: parts[3],
  //     memoryType: parts[4],
  //     memoryId: parts[5]
  //   };
  // }

  /**
   * Determine content type and format content for storage
   */
  private formatContent(content: string, memoryType: string): {
    formattedContent: string;
    contentType: 'md' | 'json' | 'text';
  } {
    // Try to detect if content is JSON
    try {
      JSON.parse(content);
      return {
        formattedContent: content,
        contentType: 'json'
      };
    } catch {
      // Not JSON
    }

    // Check memory type for format hints
    if (memoryType === 'code' || memoryType === 'documentation') {
      return {
        formattedContent: content,
        contentType: 'md'
      };
    }

    // Default to text
    return {
      formattedContent: content,
      contentType: 'text'
    };
  }

  /**
   * Store a memory in NATS KV store
   */
  async storeMemory(
    userId: string,
    projectName: string,
    memoryTopic: string,
    memoryType: string,
    content: string,
    tags: string[] = []
  ): Promise<Memory> {
    if (!this.kv) {
      throw new Error('KV store not initialized');
    }

    const memoryId = uuidv4();
    const { formattedContent, contentType } = this.formatContent(content, memoryType);

    const memory: Memory = {
      id: memoryId,
      userId,
      projectName,
      memoryTopic,
      memoryType,
      content: formattedContent,
      contentType,
      tags,
      timestamp: Date.now(),
      metadata: {
        createdAt: new Date().toISOString(),
        version: 1
      }
    };

    try {
      const key = this.generateMemoryKey(userId, projectName, memoryTopic, memoryType, memoryId);
      const data = this.codec.encode(JSON.stringify(memory));

      await this.kv.put(key, data);

      logger.info('Memory stored successfully', {
        memoryId,
        userId,
        projectName,
        memoryTopic,
        memoryType,
        contentType,
        key,
        tags
      });

      return memory;
    } catch (error) {
      logger.error('Failed to store memory', { error, userId, projectName, memoryTopic, memoryType });
      throw error;
    }
  }

  /**
   * Retrieve memories with filtering and search
   */
  async retrieveMemories(query: MemorySearchQuery): Promise<MemorySearchResult[]> {
    if (!this.kv) {
      throw new Error('KV store not initialized');
    }

    try {
      // Build key pattern for filtering
      let keyPattern = `memories.${query.userId}`;

      if (query.projectName) {
        keyPattern += `.${query.projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

        if (query.memoryTopic) {
          keyPattern += `.${query.memoryTopic.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

          if (query.memoryType) {
            keyPattern += `.${query.memoryType.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
          } else {
            keyPattern += '.*';
          }
        } else {
          keyPattern += '.*.*';
        }
      } else {
        keyPattern += '.*.*.*';
      }

      keyPattern += '.*'; // For memory ID

      // Get all keys matching the pattern
      const keys = await this.kv.keys(keyPattern);
      const results: MemorySearchResult[] = [];

      for await (const key of keys) {
        try {
          const entry = await this.kv.get(key);
          if (!entry) continue;

          const data = this.codec.decode(entry.value);
          const memory: Memory = JSON.parse(data);

          // Apply additional filters
          if (this.matchesQuery(memory, query)) {
            const similarity = this.calculateSimilarity(memory, query);

            if (similarity >= (query.similarityThreshold || 0)) {
              results.push({ memory, similarity });
            }
          }
        } catch (error) {
          logger.warn('Failed to parse memory entry', { error, key });
        }
      }

      // Sort by similarity (highest first) and timestamp (newest first)
      results.sort((a, b) => {
        if (a.similarity !== b.similarity) {
          return b.similarity - a.similarity;
        }
        return b.memory.timestamp - a.memory.timestamp;
      });

      const limitedResults = results.slice(0, query.limit || 50);

      logger.info('Retrieved memories', {
        userId: query.userId,
        projectName: query.projectName,
        memoryTopic: query.memoryTopic,
        memoryType: query.memoryType,
        count: limitedResults.length,
        query: query.query
      });

      return limitedResults;
    } catch (error) {
      logger.error('Failed to retrieve memories', { error, query });
      throw error;
    }
  }

  /**
   * Get memories by specific tags
   */
  async getMemoriesByTag(
    userId: string,
    tag: string,
    projectName?: string,
    memoryTopic?: string,
    memoryType?: string,
    limit: number = 10
  ): Promise<Memory[]> {
    const query: MemorySearchQuery = {
      userId,
      projectName,
      memoryTopic,
      memoryType,
      query: '',
      tags: [tag],
      limit
    };

    const results = await this.retrieveMemories(query);
    return results.map(r => r.memory);
  }

  /**
   * Delete a specific memory
   */
  async deleteMemory(
    { userId, projectName = "*", memoryTopic = "*", memoryType = "*", memoryId }: {
      userId: string,
      projectName?: string,
      memoryTopic?: string,
      memoryType?: string,
      memoryId: string
    }): Promise<boolean> {
    if (!this.kv) {
      throw new Error('KV store not initialized');
    }

    try {
      const key = this.generateMemoryKey(userId, projectName, memoryTopic, memoryType, memoryId);

      // Check if memory exists and belongs to user
      const entry = await this.kv.get(key);
      if (!entry) {
        logger.warn('Memory not found for deletion', { key, userId });
        return false;
      }

      // Parse memory to verify ownership
      const data = this.codec.decode(entry.value);
      const memory: Memory = JSON.parse(data);

      if (memory.userId !== userId) {
        logger.warn('Unauthorized deletion attempt', { key, userId, memoryUserId: memory.userId });
        return false;
      }

      // Delete the memory
      await this.kv.delete(key);

      logger.info('Memory deleted successfully', { key, userId, memoryId });
      return true;
    } catch (error) {
      logger.error('Failed to delete memory', { error, userId, projectName, memoryTopic, memoryType, memoryId });
      return false;
    }
  }

  /**
   * Get memory statistics for a user
   */
  async getMemoryStats(userId: string): Promise<{
    totalMemories: number;
    projects: string[];
    topics: string[];
    types: string[];
    totalTags: number;
    oldestMemory: number;
    newestMemory: number;
  }> {
    const query: MemorySearchQuery = {
      userId,
      query: '',
      limit: 10000 // Get all memories for stats
    };

    const results = await this.retrieveMemories(query);
    const memories = results.map(r => r.memory);

    const projects = new Set<string>();
    const topics = new Set<string>();
    const types = new Set<string>();
    const tags = new Set<string>();

    memories.forEach(m => {
      projects.add(m.projectName);
      topics.add(m.memoryTopic);
      types.add(m.memoryType);
      m.tags.forEach(tag => tags.add(tag));
    });

    const timestamps = memories.map(m => m.timestamp);

    return {
      totalMemories: memories.length,
      projects: Array.from(projects),
      topics: Array.from(topics),
      types: Array.from(types),
      totalTags: tags.size,
      oldestMemory: Math.min(...timestamps) || 0,
      newestMemory: Math.max(...timestamps) || 0
    };
  }

  /**
   * List all projects for a user
   */
  async getUserProjects(userId: string): Promise<string[]> {
    const stats = await this.getMemoryStats(userId);
    return stats.projects;
  }

  /**
   * List all topics for a user's project
   */
  async getProjectTopics(userId: string, projectName: string): Promise<string[]> {
    const query: MemorySearchQuery = {
      userId,
      projectName,
      query: '',
      limit: 10000
    };

    const results = await this.retrieveMemories(query);
    const topics = new Set(results.map(r => r.memory.memoryTopic));
    return Array.from(topics);
  }

  /**
   * List all types for a user's project topic
   */
  async getTopicTypes(userId: string, projectName: string, memoryTopic: string): Promise<string[]> {
    const query: MemorySearchQuery = {
      userId,
      projectName,
      memoryTopic,
      query: '',
      limit: 10000
    };

    const results = await this.retrieveMemories(query);
    const types = new Set(results.map(r => r.memory.memoryType));
    return Array.from(types);
  }

  /**
   * Check if memory matches the search query
   */
  private matchesQuery(memory: Memory, query: MemorySearchQuery): boolean {
    // Check tag filters
    if (query.tags && query.tags.length > 0) {
      const hasMatchingTag = query.tags.some(tag =>
        memory.tags.some(memoryTag =>
          memoryTag.toLowerCase().includes(tag.toLowerCase())
        )
      );
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate similarity between memory and search query
   */
  private calculateSimilarity(memory: Memory, query: MemorySearchQuery): number {
    if (!query.query || query.query.trim() === '') {
      return 1.0; // No query means all memories match equally
    }

    const searchTerms = query.query.toLowerCase().split(/\s+/);
    const memoryText = memory.content.toLowerCase();
    const memoryTags = memory.tags.map(tag => tag.toLowerCase());
    const memoryMeta = [memory.projectName, memory.memoryTopic, memory.memoryType].map(s => s.toLowerCase());

    let matches = 0;
    let totalTerms = searchTerms.length;

    for (const term of searchTerms) {
      // Check content
      if (memoryText.includes(term)) {
        matches += 1;
      }
      // Check tags (weighted higher)
      else if (memoryTags.some(tag => tag.includes(term))) {
        matches += 1.5;
      }
      // Check metadata (project, topic, type)
      else if (memoryMeta.some(meta => meta.includes(term))) {
        matches += 1.2;
      }
    }

    return Math.min(matches / totalTerms, 1.0);
  }

  /**
   * Close NATS connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.kv = null;
      logger.info('NATS connection closed');
    }
  }

  /**
   * Health check for NATS connection
   */
  isConnected(): boolean {
    return this.connection?.isClosed() === false;
  }
}
