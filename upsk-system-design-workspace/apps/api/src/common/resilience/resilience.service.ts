import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { retryWithBackoff } from './retry.util';

@Injectable()
export class ResilienceService {
  private readonly logger = new Logger(ResilienceService.name);
  private breakers = new Map<string, CircuitBreaker>();

  createCircuitBreaker<T, Args extends any[]>(
    name: string,
    action: (...args: Args) => Promise<T>,
    fallbackAction?: (...args: Args) => Promise<T> | T,
    options: CircuitBreaker.Options = {}
  ): CircuitBreaker {
    const defaultOptions: CircuitBreaker.Options = {
      timeout: 2000, // 2s timeout
      errorThresholdPercentage: 50, // Trip if 50% requests fail
      resetTimeout: 15000, // Try half-open after 15s
      volumeThreshold: 5, // Minimum 5 requests before tripping
      ...options,
    };

    const breaker = new CircuitBreaker(action, defaultOptions);

    if (fallbackAction) {
      breaker.fallback(fallbackAction);
    }

    breaker.on('open', () => {
      this.logger.warn(`Circuit Breaker [${name}] OPENED. Fast-failing downstream requests.`);
    });

    breaker.on('halfOpen', () => {
      this.logger.log(`Circuit Breaker [${name}] HALF-OPEN. Testing downstream recovery.`);
    });

    breaker.on('close', () => {
      this.logger.log(`Circuit Breaker [${name}] CLOSED. Normal operation resumed.`);
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  async executeWithResilience<T>(
    breakerName: string,
    action: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    let breaker = this.breakers.get(breakerName);
    if (!breaker) {
      breaker = this.createCircuitBreaker(breakerName, action, fallback);
    }
    return retryWithBackoff(() => breaker!.fire(), { maxRetries: 2, baseDelayMs: 100 }, this.logger);
  }
}
