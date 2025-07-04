import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { Request } from 'express';

interface CircuitBreakerState {
  failures: number;
  lastFailure: Date;
  state: 'closed' | 'open' | 'half-open';
  nextAttempt: Date;
}

@Injectable()
export class CircuitBreakerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CircuitBreakerInterceptor.name);
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  
  // Configuration
  private readonly failureThreshold = 5;
  private readonly recoveryTimeout = 60000; // 1 minute
  private readonly requestTimeout = 30000; // 30 seconds
  private readonly halfOpenMaxCalls = 3;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const circuitKey = this.getCircuitKey(request);
    
    // Check circuit breaker state
    const circuitState = this.getCircuitState(circuitKey);
    
    if (circuitState.state === 'open') {
      if (Date.now() < circuitState.nextAttempt.getTime()) {
        this.logger.warn(`Circuit breaker is OPEN for ${circuitKey}`);
        throw new ServiceUnavailableException({
          error: 'Circuit Breaker Open',
          message: 'Service is temporarily unavailable',
          circuitKey,
          nextAttempt: circuitState.nextAttempt,
        });
      } else {
        // Transition to half-open
        circuitState.state = 'half-open';
        this.logger.log(`Circuit breaker transitioning to HALF-OPEN for ${circuitKey}`);
      }
    }

    return next.handle().pipe(
      timeout(this.requestTimeout),
      catchError((error) => {
        this.recordFailure(circuitKey);
        
        // Add circuit breaker information to error
        const enhancedError = {
          ...error,
          circuitBreaker: {
            key: circuitKey,
            state: this.getCircuitState(circuitKey).state,
            failures: this.getCircuitState(circuitKey).failures,
          },
        };
        
        return throwError(() => enhancedError);
      }),
    ).pipe(
      // Record success
      catchError((error) => {
        // If this is not a circuit breaker error, record success for half-open state
        if (circuitState.state === 'half-open' && !error.circuitBreaker) {
          this.recordSuccess(circuitKey);
        }
        return throwError(() => error);
      }),
    );
  }

  private getCircuitKey(request: Request): string {
    // Create circuit breaker key based on route and service
    const route = request.route?.path || request.path;
    const service = this.extractServiceFromPath(request.path);
    return `${service}:${route}`;
  }

  private extractServiceFromPath(path: string): string {
    // Extract service name from path (e.g., /api/users -> backend, /api/analytics -> analytics)
    const pathParts = path.split('/');
    if (pathParts.length >= 3) {
      const apiSegment = pathParts[2];
      
      // Map API segments to services
      const serviceMap: Record<string, string> = {
        'auth': 'backend',
        'users': 'backend',
        'analytics': 'analytics',
        'notifications': 'notification',
      };
      
      return serviceMap[apiSegment] || 'unknown';
    }
    
    return 'unknown';
  }

  private getCircuitState(circuitKey: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(circuitKey)) {
      this.circuitBreakers.set(circuitKey, {
        failures: 0,
        lastFailure: new Date(0),
        state: 'closed',
        nextAttempt: new Date(0),
      });
    }
    
    return this.circuitBreakers.get(circuitKey)!;
  }

  private recordFailure(circuitKey: string): void {
    const circuitState = this.getCircuitState(circuitKey);
    circuitState.failures++;
    circuitState.lastFailure = new Date();

    if (circuitState.failures >= this.failureThreshold) {
      circuitState.state = 'open';
      circuitState.nextAttempt = new Date(Date.now() + this.recoveryTimeout);
      
      this.logger.warn(
        `Circuit breaker OPENED for ${circuitKey} after ${circuitState.failures} failures`
      );
    }

    this.circuitBreakers.set(circuitKey, circuitState);
  }

  private recordSuccess(circuitKey: string): void {
    const circuitState = this.getCircuitState(circuitKey);
    
    if (circuitState.state === 'half-open') {
      // Reset circuit breaker on successful half-open request
      circuitState.state = 'closed';
      circuitState.failures = 0;
      circuitState.nextAttempt = new Date(0);
      
      this.logger.log(`Circuit breaker CLOSED for ${circuitKey} after successful recovery`);
    }

    this.circuitBreakers.set(circuitKey, circuitState);
  }

  // Public methods for monitoring and management
  getCircuitBreakerStatus(): Array<{
    key: string;
    state: string;
    failures: number;
    lastFailure: Date;
    nextAttempt: Date;
  }> {
    return Array.from(this.circuitBreakers.entries()).map(([key, state]) => ({
      key,
      state: state.state,
      failures: state.failures,
      lastFailure: state.lastFailure,
      nextAttempt: state.nextAttempt,
    }));
  }

  resetCircuitBreaker(circuitKey: string): void {
    const circuitState = this.getCircuitState(circuitKey);
    circuitState.state = 'closed';
    circuitState.failures = 0;
    circuitState.nextAttempt = new Date(0);
    
    this.circuitBreakers.set(circuitKey, circuitState);
    this.logger.log(`Circuit breaker manually reset for ${circuitKey}`);
  }

  forceOpenCircuitBreaker(circuitKey: string): void {
    const circuitState = this.getCircuitState(circuitKey);
    circuitState.state = 'open';
    circuitState.nextAttempt = new Date(Date.now() + this.recoveryTimeout);
    
    this.circuitBreakers.set(circuitKey, circuitState);
    this.logger.log(`Circuit breaker manually opened for ${circuitKey}`);
  }

  getCircuitBreakerMetrics(): {
    totalCircuits: number;
    openCircuits: number;
    halfOpenCircuits: number;
    closedCircuits: number;
    totalFailures: number;
  } {
    let openCircuits = 0;
    let halfOpenCircuits = 0;
    let closedCircuits = 0;
    let totalFailures = 0;

    for (const state of this.circuitBreakers.values()) {
      switch (state.state) {
        case 'open':
          openCircuits++;
          break;
        case 'half-open':
          halfOpenCircuits++;
          break;
        case 'closed':
          closedCircuits++;
          break;
      }
      totalFailures += state.failures;
    }

    return {
      totalCircuits: this.circuitBreakers.size,
      openCircuits,
      halfOpenCircuits,
      closedCircuits,
      totalFailures,
    };
  }
}
