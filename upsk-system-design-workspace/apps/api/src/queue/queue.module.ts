import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ClicksProducer } from './clicks.producer';
import { ClicksWorker } from './clicks.worker';
import { DlqWorker } from './dlq.worker';
import { RetentionService } from './retention.service';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    }),
    BullModule.registerQueue({ name: 'clicks' }, { name: 'clicks-dlq' }),
  ],
  providers: [ClicksProducer, ClicksWorker, DlqWorker, RetentionService],
  exports: [ClicksProducer, BullModule],
})
export class QueueModule {}
