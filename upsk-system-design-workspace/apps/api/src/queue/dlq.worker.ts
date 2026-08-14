import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Worker } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import type { ClickJob } from './clicks.producer';

function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return { host: url.hostname, port: Number(url.port || 6379) };
}

@Injectable()
export class DlqWorker implements OnApplicationBootstrap {
  private readonly logger = new Logger(DlqWorker.name);
  private worker?: Worker<ClickJob>;

  constructor(private readonly redis: RedisService) {}

  onApplicationBootstrap(): void {
    this.worker = new Worker<ClickJob>(
      'clicks-dlq',
      async (job) => {
        const count = await this.redis.getClient().incr('dlq:alert:count');
        this.logger.error(
          `DLQ ALERT #${count}: click job ${job.id} failed permanently (attempts exhausted): code=${job.data.code} clickedAt=${job.data.clickedAt} reason=${job.failedReason ?? 'unknown'}`,
        );
        this.logger.error(
          `DLQ ACTION REQUIRED: analytics for code=${job.data.code} was lost; investigate payload and re-enqueue manually`,
        );
      },
      { connection: redisConnection(), concurrency: 1 },
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}