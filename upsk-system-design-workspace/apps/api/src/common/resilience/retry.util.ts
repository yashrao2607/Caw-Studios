import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  retryableErrors?: string[];
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  logger?: Logger
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 100,
    maxDelayMs = 2000,
    jitterMs = 50,
    retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'],
  } = options;

  let lastError: Error | unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const isRetryable =
        retryableErrors.includes(error?.code) ||
        error?.message?.toLowerCase().includes('timeout') ||
        error?.message?.toLowerCase().includes('connection');

      if (!isRetryable || attempt === maxRetries) {
        break;
      }

      const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitterOffset = Math.floor(Math.random() * jitterMs * 2) - jitterMs;
      const delay = Math.max(10, exponentialDelay + jitterOffset);

      logger?.warn(
        `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay (Error: ${error?.message})`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
