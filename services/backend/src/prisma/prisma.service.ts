import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor(private configService: ConfigService) {
    super({
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
    })
  }

  async onModuleInit() {
    await this.$connect()
    this.logger.log('Connected to database')

    // Log queries in development
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      // @ts-ignore
      this.$on('query', (e: any) => {
        this.logger.debug(`Query: ${e.query}`)
        this.logger.debug(`Params: ${e.params}`)
        this.logger.debug(`Duration: ${e.duration}ms`)
      })
    }

    // @ts-ignore
    this.$on('error', (e: any) => {
      this.logger.error('Prisma error:', e)
    })

    // @ts-ignore
    this.$on('info', (e: any) => {
      this.logger.log('Prisma info:', e)
    })

    // @ts-ignore
    this.$on('warn', (e: any) => {
      this.logger.warn('Prisma warning:', e)
    })
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect()
      this.logger.log('Disconnected from database')
    } catch (error) {
      this.logger.error('Error disconnecting from database:', error)
    }
  }

  /**
   * Clean disconnect for graceful shutdown
   */
  async enableShutdownHooks(app: any) {
    // @ts-ignore
    this.$on('beforeExit', async () => {
      await app.close()
    })
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      await this.$queryRaw`SELECT 1`
      return {
        status: 'healthy',
        timestamp: new Date(),
      }
    } catch (error) {
      this.logger.error('Database health check failed:', error)
      throw new Error('Database connection failed')
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    try {
      const [totalUsers, activeUsers] = await Promise.all([
        this.user.count(),
        this.user.count({
          where: { status: 'ACTIVE' },
        }),
      ])

      const [totalPosts, recentPosts] = await Promise.all([
        this.post.count(),
        this.post.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),
      ])

      const totalComments = await this.comment.count()

      return {
        users: {
          total: totalUsers,
          active: activeUsers,
        },
        posts: {
          total: totalPosts,
          recent: recentPosts,
        },
        comments: {
          total: totalComments,
        },
        timestamp: new Date(),
      }
    } catch (error) {
      this.logger.error('Failed to get database stats:', error)
      throw error
    }
  }

  /**
   * Execute raw SQL query
   */
  async executeRaw(query: string, ...params: any[]): Promise<any> {
    try {
      return await this.$queryRawUnsafe(query, ...params)
    } catch (error) {
      this.logger.error(`Raw query error: ${error.message}`, error)
      throw error
    }
  }

  /**
   * Execute transaction
   */
  async transaction<T>(
    fn: (prisma: PrismaService) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T> {
    try {
      return await this.$transaction(fn as any, options)
    } catch (error) {
      this.logger.error(`Transaction error: ${error.message}`, error)
      throw error
    }
  }
}
