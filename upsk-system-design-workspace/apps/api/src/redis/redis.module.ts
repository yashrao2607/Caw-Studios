import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: RedisService,
      useFactory: () =>
        new RedisService(
          new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
            connectTimeout: 2_000,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            retryStrategy: (times) => Math.min(times * 500, 5_000),
          }),
        ),
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
