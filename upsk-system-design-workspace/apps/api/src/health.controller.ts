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

  @Get('live')
  checkLive() {
    return { ok: true, status: 'live', uptime_seconds: Math.floor(process.uptime()) };
  }

  @Get('ready')
  async checkReady() {
    const checks: { database: string; redis: string; uptime_seconds: number } = {
      database: 'disconnected',
      redis: 'disconnected',
      uptime_seconds: Math.floor(process.uptime()),
    };

    let dbOk = false;
    let redisOk = false;

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      checks.database = 'connected';
      dbOk = true;
    } catch (e: any) {
      checks.database = `error: ${e?.message || 'timeout'}`;
    }

    try {
      await this.redis.ping();
      checks.redis = 'connected';
      redisOk = true;
    } catch (e: any) {
      checks.redis = `error: ${e?.message || 'timeout'}`;
    }

    const isReady = dbOk && redisOk;
    if (!isReady) {
      throw new HttpException(
        { ok: false, ready: false, checks },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { ok: true, ready: true, checks };
  }
}
