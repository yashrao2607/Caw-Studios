import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Worker } from 'bullmq';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { ClickJob } from './clicks.producer';

function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return { host: url.hostname, port: Number(url.port || 6379) };
}

@Injectable()
export class ClicksWorker implements OnApplicationBootstrap {
  private readonly logger = new Logger(ClicksWorker.name);
  private worker?: Worker<ClickJob>;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    this.worker = new Worker<ClickJob>(
      'clicks',
      async (job) => {
        const { code, clickedAt, userAgent, referrer, ipHash } = job.data;
        const link = await this.prisma.link.findUnique({
          where: { code },
          select: { id: true },
        });
        if (!link) {
          return;
        }
        const dedupeKey = createHash('sha256')
          .update(
            [code, clickedAt, ipHash ?? '', userAgent ?? '', referrer ?? ''].join('|'),
          )
          .digest('hex');
        const result = await this.prisma.clickEvent.createMany({
          data: {
            linkId: link.id,
            clickedAt: new Date(clickedAt),
            userAgent,
            referrer,
            ipHash,
            dedupeKey,
          },
          skipDuplicates: true,
        });
        if (result.count === 1) {
          this.logger.log(`recorded click for ${code} (link ${link.id})`);
        } else {
          this.logger.warn(`duplicate click job skipped for ${code} (${dedupeKey})`);
        }
      },
      { connection: redisConnection(), concurrency: 5 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`click job failed for ${job?.data.code}: ${err.message}`);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}