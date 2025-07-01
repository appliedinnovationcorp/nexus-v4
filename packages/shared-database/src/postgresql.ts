/**
 * PostgreSQL database utilities for Nexus workspace
 * Provides connection management and query utilities
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { PostgreSQLConfig } from './config';
import { getDatabaseConfig } from './config';

export class PostgreSQLConnection {
  private pool: Pool | null = null;
  private config: PostgreSQLConfig;

  constructor(config?: PostgreSQLConfig) {
    this.config = config || getDatabaseConfig().postgresql;
  }

  /**
   * Initialize the connection pool
   */
  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      max: this.config.max,
      min: this.config.min,
    });

    // Test the connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
    } catch (error) {
      await this.disconnect();
      throw new Error(`Failed to connect to PostgreSQL: ${error}`);
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * Execute a query
   */
  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    try {
      return await this.pool.query<T>(text, params);
    } catch (error) {
      throw new Error(`Query failed: ${error}`);
    }
  }

  /**
   * Execute a query with a specific client (for transactions)
   */
  async queryWithClient<T extends QueryResultRow = any>(
    client: PoolClient,
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    try {
      return await client.query<T>(text, params);
    } catch (error) {
      throw new Error(`Query failed: ${error}`);
    }
  }

  /**
   * Get a client from the pool (for transactions)
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    return await this.pool.connect();
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if the database is connected and healthy
   */
  async healthCheck(): Promise<{
    connected: boolean;
    latency?: number;
    error?: string;
  }> {
    if (!this.pool) {
      return { connected: false, error: 'Not connected' };
    }

    try {
      const start = Date.now();
      await this.query('SELECT 1');
      const latency = Date.now() - start;

      return { connected: true, latency };
    } catch (error) {
      return { connected: false, error: String(error) };
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    if (!this.pool) {
      return { totalCount: 0, idleCount: 0, waitingCount: 0 };
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Get the connection URL (without password for logging)
   */
  getConnectionInfo(): {
    host: string;
    port: number;
    database: string;
    username: string;
    ssl: boolean;
  } {
    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      username: this.config.username,
      ssl: this.config.ssl || false,
    };
  }
}

// Singleton instance for shared use
let sharedConnection: PostgreSQLConnection | null = null;

/**
 * Get the shared PostgreSQL connection instance
 */
export function getPostgreSQLConnection(config?: PostgreSQLConfig): PostgreSQLConnection {
  if (!sharedConnection) {
    sharedConnection = new PostgreSQLConnection(config);
  }
  return sharedConnection;
}

/**
 * Initialize the shared PostgreSQL connection
 */
export async function initializePostgreSQL(config?: PostgreSQLConfig): Promise<void> {
  const connection = getPostgreSQLConnection(config);
  await connection.connect();
}

/**
 * Close the shared PostgreSQL connection
 */
export async function closePostgreSQL(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.disconnect();
    sharedConnection = null;
  }
}

/**
 * Execute a query using the shared connection
 */
export async function executeQuery<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const connection = getPostgreSQLConnection();
  return await connection.query<T>(text, params);
}

/**
 * Execute a transaction using the shared connection
 */
export async function executeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const connection = getPostgreSQLConnection();
  return await connection.transaction(callback);
}

/**
 * Check PostgreSQL health using the shared connection
 */
export async function checkPostgreSQLHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
  poolStats?: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
}> {
  try {
    const connection = getPostgreSQLConnection();
    const health = await connection.healthCheck();
    
    if (health.connected) {
      return {
        ...health,
        poolStats: connection.getPoolStats(),
      };
    }
    
    return health;
  } catch (error) {
    return { connected: false, error: String(error) };
  }
}
