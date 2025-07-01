import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });

    // Log queries in development
    if (configService.get<string>('NODE_ENV') === 'development') {
      this.$on('query', (e) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Params: ${e.params}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    this.$on('error', (e) => {
      this.logger.error('Prisma error:', e);
    });

    this.$on('info', (e) => {
      this.logger.log('Prisma info:', e);
    });

    this.$on('warn', (e) => {
      this.logger.warn('Prisma warning:', e);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Disconnected from database');
    } catch (error) {
      this.logger.error('Error disconnecting from database:', error);
    }
  }

  /**
   * Clean disconnect for graceful shutdown
   */
  async enableShutdownHooks(app: any) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      throw new Error('Database connection failed');
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    try {
      const [
        userCount,
        postCount,
        commentCount,
        activeUserCount,
        recentPostCount,
      ] = await Promise.all([
        this.user.count(),
        this.post.count(),
        this.comment.count(),
        this.user.count({
          where: {
            lastLoginAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
        }),
        this.post.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),
      ]);

      return {
        users: {
          total: userCount,
          active: activeUserCount,
        },
        posts: {
          total: postCount,
          recent: recentPostCount,
        },
        comments: {
          total: commentCount,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get database statistics:', error);
      throw error;
    }
  }

  /**
   * Execute raw SQL query with logging
   */
  async executeRaw(query: string, ...params: any[]) {
    try {
      this.logger.debug(`Executing raw query: ${query}`);
      return await this.$queryRawUnsafe(query, ...params);
    } catch (error) {
      this.logger.error(`Raw query failed: ${query}`, error);
      throw error;
    }
  }

  /**
   * Transaction wrapper with error handling
   */
  async transaction<T>(
    fn: (prisma: Omit<this, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
    }
  ): Promise<T> {
    try {
      return await this.$transaction(fn, options);
    } catch (error) {
      this.logger.error('Transaction failed:', error);
      throw error;
    }
  }
}
