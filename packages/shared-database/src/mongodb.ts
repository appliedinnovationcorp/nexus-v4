/**
 * MongoDB database utilities for Nexus workspace
 * Provides connection management and query utilities
 */

import { MongoClient, Db, Collection, ClientSession, Document } from 'mongodb';
import type { MongoDBConfig } from './config';
import { getDatabaseConfig, getMongoDBUrl } from './config';

export class MongoDBConnection {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private config: MongoDBConfig;

  constructor(config?: MongoDBConfig) {
    this.config = config || getDatabaseConfig().mongodb;
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    const url = getMongoDBUrl(this.config);
    
    this.client = new MongoClient(url, {
      maxPoolSize: this.config.maxPoolSize,
      minPoolSize: this.config.minPoolSize,
      maxIdleTimeMS: this.config.maxIdleTimeMS,
      serverSelectionTimeoutMS: this.config.serverSelectionTimeoutMS,
    });

    try {
      await this.client.connect();
      this.db = this.client.db(this.config.database);
      
      // Test the connection
      await this.db.admin().ping();
    } catch (error) {
      await this.disconnect();
      throw new Error(`Failed to connect to MongoDB: ${error}`);
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  /**
   * Get the database instance
   */
  getDatabase(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Get a collection
   */
  getCollection<T extends Document = Document>(name: string): Collection<T> {
    const db = this.getDatabase();
    return db.collection<T>(name);
  }

  /**
   * Start a session for transactions
   */
  startSession(): ClientSession {
    if (!this.client) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.client.startSession();
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (session: ClientSession) => Promise<T>
  ): Promise<T> {
    const session = this.startSession();

    try {
      return await session.withTransaction(async () => {
        return await callback(session);
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Check if MongoDB is connected and healthy
   */
  async healthCheck(): Promise<{
    connected: boolean;
    latency?: number;
    error?: string;
  }> {
    if (!this.db) {
      return { connected: false, error: 'Not connected' };
    }

    try {
      const start = Date.now();
      await this.db.admin().ping();
      const latency = Date.now() - start;

      return { connected: true, latency };
    } catch (error) {
      return { connected: false, error: String(error) };
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<any> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }

    try {
      return await this.db.stats();
    } catch (error) {
      throw new Error(`Failed to get database stats: ${error}`);
    }
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<string[]> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }

    try {
      const collections = await this.db.listCollections().toArray();
      return collections.map(col => col.name);
    } catch (error) {
      throw new Error(`Failed to list collections: ${error}`);
    }
  }

  /**
   * Create a collection with validation
   */
  async createCollection(
    name: string,
    options?: {
      validator?: any;
      validationLevel?: 'off' | 'strict' | 'moderate';
      validationAction?: 'error' | 'warn';
    }
  ): Promise<Collection> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }

    try {
      return await this.db.createCollection(name, options);
    } catch (error) {
      throw new Error(`Failed to create collection ${name}: ${error}`);
    }
  }

  /**
   * Drop a collection
   */
  async dropCollection(name: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }

    try {
      return await this.db.dropCollection(name);
    } catch (error) {
      throw new Error(`Failed to drop collection ${name}: ${error}`);
    }
  }

  /**
   * Get connection information
   */
  getConnectionInfo(): {
    host: string;
    port: number;
    database: string;
    username: string;
  } {
    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      username: this.config.username,
    };
  }
}

// Singleton instance for shared use
let sharedConnection: MongoDBConnection | null = null;

/**
 * Get the shared MongoDB connection instance
 */
export function getMongoDBConnection(config?: MongoDBConfig): MongoDBConnection {
  if (!sharedConnection) {
    sharedConnection = new MongoDBConnection(config);
  }
  return sharedConnection;
}

/**
 * Initialize the shared MongoDB connection
 */
export async function initializeMongoDB(config?: MongoDBConfig): Promise<void> {
  const connection = getMongoDBConnection(config);
  await connection.connect();
}

/**
 * Close the shared MongoDB connection
 */
export async function closeMongoDB(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.disconnect();
    sharedConnection = null;
  }
}

/**
 * Get a collection using the shared connection
 */
export function getCollection<T extends Document = Document>(name: string): Collection<T> {
  const connection = getMongoDBConnection();
  return connection.getCollection<T>(name);
}

/**
 * Execute a transaction using the shared connection
 */
export async function executeMongoTransaction<T>(
  callback: (session: ClientSession) => Promise<T>
): Promise<T> {
  const connection = getMongoDBConnection();
  return await connection.transaction(callback);
}

/**
 * Check MongoDB health using the shared connection
 */
export async function checkMongoDBHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
  stats?: any;
  collections?: string[];
}> {
  try {
    const connection = getMongoDBConnection();
    const health = await connection.healthCheck();
    
    if (health.connected) {
      const [stats, collections] = await Promise.all([
        connection.getStats().catch(() => null),
        connection.listCollections().catch(() => []),
      ]);
      
      return {
        ...health,
        stats,
        collections,
      };
    }
    
    return health;
  } catch (error) {
    return { connected: false, error: String(error) };
  }
}

/**
 * Common MongoDB operations
 */
export const mongoOperations = {
  /**
   * Insert a document
   */
  async insertOne(collectionName: string, document: any): Promise<any> {
    const collection = getCollection(collectionName);
    return await collection.insertOne(document);
  },

  /**
   * Insert multiple documents
   */
  async insertMany(collectionName: string, documents: any[]): Promise<any> {
    const collection = getCollection(collectionName);
    return await collection.insertMany(documents);
  },

  /**
   * Find documents
   */
  async find<T extends Document>(collectionName: string, filter: any = {}, options: any = {}): Promise<any[]> {
    const collection = getCollection<T>(collectionName);
    return await collection.find(filter, options).toArray();
  },

  /**
   * Find one document
   */
  async findOne<T extends Document>(collectionName: string, filter: any = {}, options: any = {}): Promise<any> {
    const collection = getCollection<T>(collectionName);
    return await collection.findOne(filter, options);
  },

  /**
   * Update one document
   */
  async updateOne(collectionName: string, filter: any, update: any, options: any = {}): Promise<any> {
    const collection = getCollection(collectionName);
    return await collection.updateOne(filter, update, options);
  },

  /**
   * Update multiple documents
   */
  async updateMany(collectionName: string, filter: any, update: any, options: any = {}): Promise<any> {
    const collection = getCollection(collectionName);
    return await collection.updateMany(filter, update, options);
  },

  /**
   * Delete one document
   */
  async deleteOne(collectionName: string, filter: any): Promise<any> {
    const collection = getCollection(collectionName);
    return await collection.deleteOne(filter);
  },

  /**
   * Delete multiple documents
   */
  async deleteMany(collectionName: string, filter: any): Promise<any> {
    const collection = getCollection(collectionName);
    return await collection.deleteMany(filter);
  },

  /**
   * Count documents
   */
  async countDocuments(collectionName: string, filter: any = {}): Promise<number> {
    const collection = getCollection(collectionName);
    return await collection.countDocuments(filter);
  },

  /**
   * Create an index
   */
  async createIndex(collectionName: string, indexSpec: any, options: any = {}): Promise<string> {
    const collection = getCollection(collectionName);
    return await collection.createIndex(indexSpec, options);
  },

  /**
   * Drop an index
   */
  async dropIndex(collectionName: string, indexName: string): Promise<any> {
    const collection = getCollection(collectionName);
    return await collection.dropIndex(indexName);
  },
};
