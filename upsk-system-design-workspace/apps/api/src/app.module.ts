import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { LinksModule } from './links/links.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        autoLogging: true,
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],
          censor: '[REDACTED]',
        },
        customProps: (req) => ({ requestId: (req as { requestId?: string }).requestId }),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
    ...(process.env.NODE_ENV === 'test'
      ? []
      : [
          ThrottlerModule.forRoot([
            { name: 'default', ttl: 60_000, limit: 300 },
            { name: 'login', ttl: 60_000, limit: 10 },
            { name: 'create-link', ttl: 60_000, limit: 30 },
            { name: 'redirect', ttl: 60_000, limit: 120 },
            { name: 'analytics', ttl: 60_000, limit: 60 },
          ]),
        ]),
    PrismaModule,
    RedisModule,
    QueueModule,
    LinksModule,
    AuthModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    ...(process.env.NODE_ENV === 'test'
      ? []
      : [
          {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
          },
        ]),
  ],
})
export class AppModule {}
