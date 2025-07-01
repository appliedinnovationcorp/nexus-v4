/**
 * Database configuration utilities for Nexus workspace
 * Provides centralized configuration for all database connections
 */

export interface DatabaseConfig {
  postgresql: PostgreSQLConfig;
  mongodb: MongoDBConfig;
  redis: RedisConfig;
}

export interface PostgreSQLConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
  min?: number;
}

export interface MongoDBConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  authSource?: string;
  ssl?: boolean;
  maxPoolSize?: number;
  minPoolSize?: number;
  maxIdleTimeMS?: number;
  serverSelectionTimeoutMS?: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  connectTimeout?: number;
  lazyConnect?: boolean;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
}

/**
 * Get database configuration from environment variables
 */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    postgresql: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'nexus_dev',
      username: process.env.POSTGRES_USER || 'nexus_user',
      password: process.env.POSTGRES_PASSWORD || 'nexus_password',
      ssl: process.env.POSTGRES_SSL === 'true',
      connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '10000', 10),
      idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000', 10),
      max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
      min: parseInt(process.env.POSTGRES_MIN_CONNECTIONS || '2', 10),
    },
    mongodb: {
      host: process.env.MONGO_HOST || 'localhost',
      port: parseInt(process.env.MONGO_PORT || '27017', 10),
      database: process.env.MONGO_DB || 'nexus_nosql',
      username: process.env.MONGO_ROOT_USER || 'admin',
      password: process.env.MONGO_ROOT_PASSWORD || 'admin_password',
      authSource: process.env.MONGO_AUTH_SOURCE || 'admin',
      ssl: process.env.MONGO_SSL === 'true',
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '10', 10),
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '2', 10),
      maxIdleTimeMS: parseInt(process.env.MONGO_MAX_IDLE_TIME || '30000', 10),
      serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT || '5000', 10),
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || 'redis_password',
      database: parseInt(process.env.REDIS_DATABASE || '0', 10),
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
      lazyConnect: process.env.REDIS_LAZY_CONNECT === 'true',
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
    },
  };
}

/**
 * Get PostgreSQL connection URL
 */
export function getPostgreSQLUrl(config?: PostgreSQLConfig): string {
  const pgConfig = config || getDatabaseConfig().postgresql;
  const sslParam = pgConfig.ssl ? '?sslmode=require' : '';
  return `postgresql://${pgConfig.username}:${pgConfig.password}@${pgConfig.host}:${pgConfig.port}/${pgConfig.database}${sslParam}`;
}

/**
 * Get MongoDB connection URL
 */
export function getMongoDBUrl(config?: MongoDBConfig): string {
  const mongoConfig = config || getDatabaseConfig().mongodb;
  const authSource = mongoConfig.authSource ? `?authSource=${mongoConfig.authSource}` : '';
  return `mongodb://${mongoConfig.username}:${mongoConfig.password}@${mongoConfig.host}:${mongoConfig.port}/${mongoConfig.database}${authSource}`;
}

/**
 * Get Redis connection URL
 */
export function getRedisUrl(config?: RedisConfig): string {
  const redisConfig = config || getDatabaseConfig().redis;
  const auth = redisConfig.password ? `:${redisConfig.password}@` : '';
  const db = redisConfig.database ? `/${redisConfig.database}` : '';
  return `redis://${auth}${redisConfig.host}:${redisConfig.port}${db}`;
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate PostgreSQL config
  if (!config.postgresql.host) {
    errors.push('PostgreSQL host is required');
  }
  if (!config.postgresql.database) {
    errors.push('PostgreSQL database name is required');
  }
  if (!config.postgresql.username) {
    errors.push('PostgreSQL username is required');
  }
  if (!config.postgresql.password) {
    errors.push('PostgreSQL password is required');
  }

  // Validate MongoDB config
  if (!config.mongodb.host) {
    errors.push('MongoDB host is required');
  }
  if (!config.mongodb.database) {
    errors.push('MongoDB database name is required');
  }
  if (!config.mongodb.username) {
    errors.push('MongoDB username is required');
  }
  if (!config.mongodb.password) {
    errors.push('MongoDB password is required');
  }

  // Validate Redis config
  if (!config.redis.host) {
    errors.push('Redis host is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
