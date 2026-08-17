import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  checkHealth() {
    return { ok: true, timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async checkReady() {
    const checks: { database: boolean; redis: boolean } = {
      database: false,
      redis: false,
    };

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      checks.database = true;
    } catch {
      checks.database = false;
    }

    try {
      await this.redis.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }

    const isReady = checks.database && checks.redis;
    if (!isReady) {
      throw new HttpException(
        { ok: false, ready: false, checks },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { ok: true, ready: true, checks };
  }
}
