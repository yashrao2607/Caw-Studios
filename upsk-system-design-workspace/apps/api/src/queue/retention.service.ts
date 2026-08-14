import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RetentionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RetentionService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    void this.purgeExpired();
    const hours = Number(process.env.RETENTION_PURGE_INTERVAL_HOURS ?? 24);
    if (!Number.isFinite(hours) || hours <= 0) {
      this.logger.warn(
        'RETENTION_PURGE_INTERVAL_HOURS invalid, defaulting to 24h periodic purge',
      );
    }
    const intervalMs = (Number.isFinite(hours) && hours > 0 ? hours : 24) * 60 * 60 * 1000;
    this.timer = setInterval(() => void this.purgeExpired(), intervalMs);
    this.timer.unref();
    this.logger.log(`retention purge scheduled every ${intervalMs / 3_600_000}h`);
  }

  async purgeExpired(): Promise<number> {
    const retentionDays = Number(
      process.env.RETENTION_DAYS ?? 30,
    );
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.clickEvent.deleteMany({
      where: { clickedAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      this.logger.log(`retention purge: deleted ${result.count} click(s) older than ${retentionDays}d`);
    }
    return result.count;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}