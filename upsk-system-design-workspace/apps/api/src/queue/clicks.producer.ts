import { Injectable, Logger } from '@nestjs/common';
import { FlowProducer } from 'bullmq';

export interface ClickJob {
  code: string;
  clickedAt: string;
  userAgent: string | null;
  referrer: string | null;
  ipHash: string | null;
}

@Injectable()
export class ClicksProducer {
  private readonly logger = new Logger(ClicksProducer.name);
  private readonly flow: FlowProducer;

  constructor() {
    this.flow = new FlowProducer({
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    });
  }

  async enqueue(job: ClickJob): Promise<void> {
    await this.flow.add({
      name: 'record-click',
      queueName: 'clicks-dlq',
      data: job,
      children: [
        {
          name: 'record-click',
          queueName: 'clicks',
          data: job,
          opts: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: 1000,
            removeOnFail: 0,
          },
        },
      ],
    });
    this.logger.debug(`queued click job for ${job.code}`);
  }
}