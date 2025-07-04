import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

// Core modules
import { RoutingModule } from './routing/routing.module';
import { LoadBalancerModule } from './load-balancer/load-balancer.module';
import { ServiceDiscoveryModule } from './service-discovery/service-discovery.module';
import { AuthenticationModule } from './authentication/authentication.module';
import { RateLimitingModule } from './rate-limiting/rate-limiting.module';
import { HealthModule } from './health/health.module';

// Middleware and interceptors
import { RequestLoggingMiddleware } from './middleware/request-logging.middleware';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { ServiceMeshInterceptor } from './interceptors/service-mesh.interceptor';
import { CircuitBreakerInterceptor } from './interceptors/circuit-breaker.interceptor';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
      cache: true,
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 100,
      },
      {
        name: 'long',
        ttl: 900000, // 15 minutes
        limit: 1000,
      },
    ]),

    // Health checks
    TerminusModule,

    // Core gateway modules
    RoutingModule,
    LoadBalancerModule,
    ServiceDiscoveryModule,
    AuthenticationModule,
    RateLimitingModule,
    HealthModule,
  ],
  providers: [
    // Global guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },

    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: ServiceMeshInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CircuitBreakerInterceptor,
    },

    // Global filters
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, RequestLoggingMiddleware)
      .forRoutes('*');
  }
}
